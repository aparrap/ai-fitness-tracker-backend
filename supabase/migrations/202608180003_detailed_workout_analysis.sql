begin;

-- ============================================================
-- DETAILED WORKOUT ANALYSIS
--
-- Reproducible schema for high-resolution HealthKit samples and
-- server-derived kilometre splits. Statements are deliberately
-- tolerant of the same changes having been applied manually first.
-- ============================================================

alter table public.workout_metric_samples
  add column if not exists sample_ended_at timestamptz,
  add column if not exists association_kind text,
  add column if not exists source_name text,
  add column if not exists source_bundle_identifier text;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conrelid = 'public.workout_metric_samples'::regclass
      and conname = 'workout_metric_samples_association_kind_check'
  ) then
    alter table public.workout_metric_samples
      add constraint workout_metric_samples_association_kind_check
      check (
        association_kind is null
        or association_kind in (
          'workout_associated',
          'time_window',
          'route_derived',
          'server_derived'
        )
      );
  end if;
end
$$;

create index if not exists idx_workout_metric_samples_workout_time
  on public.workout_metric_samples(workout_id, sampled_at);

create index if not exists idx_workout_metric_samples_metric_time
  on public.workout_metric_samples(workout_id, metric_name, sampled_at);

create table if not exists public.workout_splits (
  id bigint generated always as identity primary key,
  workout_id uuid not null
    references public.workouts(id)
    on delete cascade,
  split_kind text not null default 'kilometre',
  split_number integer not null,
  started_at timestamptz,
  ended_at timestamptz,
  start_distance_m numeric(12,3),
  end_distance_m numeric(12,3),
  distance_m numeric(12,3) not null,
  duration_seconds numeric(12,3) not null,
  avg_pace_seconds_per_km numeric(12,3),
  avg_heart_rate_bpm numeric(6,2),
  max_heart_rate_bpm numeric(6,2),
  heart_rate_change_bpm numeric(7,2),
  source text not null default 'server_derived',
  algorithm_version text not null default 'km-v1',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.workout_splits'::regclass
      and conname = 'workout_splits_split_kind_check'
  ) then
    alter table public.workout_splits
      add constraint workout_splits_split_kind_check
      check (split_kind in ('kilometre', 'lap', 'segment'));
  end if;

  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.workout_splits'::regclass
      and conname = 'workout_splits_split_number_check'
  ) then
    alter table public.workout_splits
      add constraint workout_splits_split_number_check
      check (split_number > 0);
  end if;

  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.workout_splits'::regclass
      and conname = 'workout_splits_distance_m_check'
  ) then
    alter table public.workout_splits
      add constraint workout_splits_distance_m_check
      check (distance_m > 0);
  end if;

  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.workout_splits'::regclass
      and conname = 'workout_splits_duration_seconds_check'
  ) then
    alter table public.workout_splits
      add constraint workout_splits_duration_seconds_check
      check (duration_seconds > 0);
  end if;

  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.workout_splits'::regclass
      and conname = 'workout_splits_avg_pace_seconds_per_km_check'
  ) then
    alter table public.workout_splits
      add constraint workout_splits_avg_pace_seconds_per_km_check
      check (avg_pace_seconds_per_km is null or avg_pace_seconds_per_km > 0);
  end if;

  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.workout_splits'::regclass
      and conname = 'workout_splits_avg_heart_rate_bpm_check'
  ) then
    alter table public.workout_splits
      add constraint workout_splits_avg_heart_rate_bpm_check
      check (avg_heart_rate_bpm is null or avg_heart_rate_bpm > 0);
  end if;

  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.workout_splits'::regclass
      and conname = 'workout_splits_max_heart_rate_bpm_check'
  ) then
    alter table public.workout_splits
      add constraint workout_splits_max_heart_rate_bpm_check
      check (max_heart_rate_bpm is null or max_heart_rate_bpm > 0);
  end if;
end
$$;

create unique index if not exists uq_workout_splits_workout_kind_number
  on public.workout_splits(workout_id, split_kind, split_number);

create index if not exists idx_workout_splits_workout
  on public.workout_splits(workout_id, split_kind, split_number);

alter table public.workout_splits enable row level security;

drop policy if exists "Users can access own workout splits"
  on public.workout_splits;

create policy "Users can access own workout splits"
on public.workout_splits
for all
using (
  exists (
    select 1
    from public.workouts w
    join public.fitness_profiles p on p.id = w.profile_id
    where w.id = workout_splits.workout_id
      and p.auth_user_id = (select auth.uid())
  )
)
with check (
  exists (
    select 1
    from public.workouts w
    join public.fitness_profiles p on p.id = w.profile_id
    where w.id = workout_splits.workout_id
      and p.auth_user_id = (select auth.uid())
  )
);

commit;
