begin;

-- ============================================================
-- WORKOUT ANALYSIS HARDENING
--
-- 1. Makes kilometre split replacement atomic and serialised per workout.
-- 2. Persists deterministic backend analysis snapshots so longitudinal
--    trend reads do not repeatedly scan raw high-resolution samples.
-- ============================================================

create table if not exists public.workout_analysis_snapshots (
  workout_id uuid primary key
    references public.workouts(id)
    on delete cascade,
  analysis jsonb not null,
  algorithm_version text not null default 'analysis-v1',
  computed_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.workout_analysis_snapshots enable row level security;

drop policy if exists "Users can access own workout analysis snapshots"
  on public.workout_analysis_snapshots;

create policy "Users can access own workout analysis snapshots"
on public.workout_analysis_snapshots
for all
using (
  exists (
    select 1
    from public.workouts w
    join public.fitness_profiles p on p.id = w.profile_id
    where w.id = workout_analysis_snapshots.workout_id
      and p.auth_user_id = (select auth.uid())
  )
)
with check (
  exists (
    select 1
    from public.workouts w
    join public.fitness_profiles p on p.id = w.profile_id
    where w.id = workout_analysis_snapshots.workout_id
      and p.auth_user_id = (select auth.uid())
  )
);

create or replace function public.replace_workout_kilometre_splits(
  p_workout_id uuid,
  p_splits jsonb
)
returns setof public.workout_splits
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_now timestamptz := now();
begin
  if jsonb_typeof(coalesce(p_splits, '[]'::jsonb)) <> 'array' then
    raise exception 'p_splits must be a JSON array';
  end if;

  -- Serialise concurrent recalculations for the same workout. The advisory
  -- transaction lock is released automatically when this RPC completes.
  perform pg_advisory_xact_lock(hashtextextended(p_workout_id::text, 0));

  with incoming as (
    select *
    from jsonb_to_recordset(coalesce(p_splits, '[]'::jsonb)) as x(
      split_kind text,
      split_number integer,
      started_at timestamptz,
      ended_at timestamptz,
      start_distance_m numeric,
      end_distance_m numeric,
      distance_m numeric,
      duration_seconds numeric,
      avg_pace_seconds_per_km numeric,
      avg_heart_rate_bpm numeric,
      max_heart_rate_bpm numeric,
      heart_rate_change_bpm numeric,
      source text,
      algorithm_version text
    )
  )
  insert into public.workout_splits (
    workout_id,
    split_kind,
    split_number,
    started_at,
    ended_at,
    start_distance_m,
    end_distance_m,
    distance_m,
    duration_seconds,
    avg_pace_seconds_per_km,
    avg_heart_rate_bpm,
    max_heart_rate_bpm,
    heart_rate_change_bpm,
    source,
    algorithm_version,
    updated_at
  )
  select
    p_workout_id,
    coalesce(i.split_kind, 'kilometre'),
    i.split_number,
    i.started_at,
    i.ended_at,
    i.start_distance_m,
    i.end_distance_m,
    i.distance_m,
    i.duration_seconds,
    i.avg_pace_seconds_per_km,
    i.avg_heart_rate_bpm,
    i.max_heart_rate_bpm,
    i.heart_rate_change_bpm,
    coalesce(i.source, 'server_derived'),
    coalesce(i.algorithm_version, 'km-v1'),
    v_now
  from incoming i
  on conflict (workout_id, split_kind, split_number)
  do update set
    started_at = excluded.started_at,
    ended_at = excluded.ended_at,
    start_distance_m = excluded.start_distance_m,
    end_distance_m = excluded.end_distance_m,
    distance_m = excluded.distance_m,
    duration_seconds = excluded.duration_seconds,
    avg_pace_seconds_per_km = excluded.avg_pace_seconds_per_km,
    avg_heart_rate_bpm = excluded.avg_heart_rate_bpm,
    max_heart_rate_bpm = excluded.max_heart_rate_bpm,
    heart_rate_change_bpm = excluded.heart_rate_change_bpm,
    source = excluded.source,
    algorithm_version = excluded.algorithm_version,
    updated_at = v_now;

  -- Remove stale trailing kilometre splits in the same database transaction.
  delete from public.workout_splits existing
  where existing.workout_id = p_workout_id
    and existing.split_kind = 'kilometre'
    and not exists (
      select 1
      from jsonb_to_recordset(coalesce(p_splits, '[]'::jsonb)) as x(
        split_kind text,
        split_number integer
      )
      where coalesce(x.split_kind, 'kilometre') = existing.split_kind
        and x.split_number = existing.split_number
    );

  return query
  select *
  from public.workout_splits
  where workout_id = p_workout_id
    and split_kind = 'kilometre'
  order by split_number;
end;
$$;

commit;
