begin;

-- ============================================================
-- HEALTHKIT AS CANONICAL WORKOUT SOURCE
--
-- HealthKit anchored queries can report additions/updates and deletions.
-- We soft-delete workouts so source links, raw telemetry and prior analyses
-- remain auditable and a later HealthKit reappearance can restore the row.
-- ============================================================

alter table public.workouts
  add column if not exists deleted_at timestamptz;

alter table public.data_syncs
  add column if not exists workouts_deleted integer not null default 0;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conrelid = 'public.data_syncs'::regclass
      and conname = 'data_syncs_workouts_deleted_check'
  ) then
    alter table public.data_syncs
      add constraint data_syncs_workouts_deleted_check
      check (workouts_deleted >= 0);
  end if;
end
$$;

create index if not exists idx_workouts_profile_active_date
  on public.workouts(profile_id, started_on desc)
  where deleted_at is null;

-- ============================================================
-- COACHING EVALUATIONS
--
-- One deterministic coaching evaluation is stored per workout/prompt version.
-- The input fingerprint prevents unchanged HealthKit replays/manual reimports
-- from spending another model call or producing duplicate notifications.
-- ============================================================

alter table public.ai_analyses
  add column if not exists updated_at timestamptz not null default now(),
  add column if not exists input_hash text;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conrelid = 'public.ai_analyses'::regclass
      and conname = 'ai_analyses_workout_prompt_unique'
  ) then
    alter table public.ai_analyses
      add constraint ai_analyses_workout_prompt_unique
      unique (profile_id, workout_id, analysis_type, prompt_version);
  end if;
end
$$;

create index if not exists idx_ai_analyses_workout_type
  on public.ai_analyses(workout_id, analysis_type, updated_at desc)
  where workout_id is not null;

-- ============================================================
-- SAMPLE OWNERSHIP DEFENCE-IN-DEPTH
--
-- The iOS mapper allocates fallback samples deterministically, but the database
-- also prevents a weaker time-window association from stealing a sample that
-- was already explicitly associated with another workout. Two fallback-only
-- imports likewise keep the first stable ownership unless an explicit
-- association later arrives.
-- ============================================================

create or replace function public.protect_workout_metric_sample_ownership()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
begin
  if old.workout_id = new.workout_id then
    return new;
  end if;

  if new.association_kind = 'workout_associated' then
    return new;
  end if;

  if old.association_kind in ('workout_associated', 'time_window')
     and new.association_kind = 'time_window' then
    -- Keep stable ownership, but do not throw away legitimate corrections to
    -- value, timestamps, units or provenance delivered by a later sync.
    new.workout_id := old.workout_id;
    new.association_kind := old.association_kind;
    return new;
  end if;

  return new;
end;
$$;

drop trigger if exists trg_protect_workout_metric_sample_ownership
  on public.workout_metric_samples;

create trigger trg_protect_workout_metric_sample_ownership
before update of workout_id, association_kind
on public.workout_metric_samples
for each row
execute function public.protect_workout_metric_sample_ownership();

commit;
