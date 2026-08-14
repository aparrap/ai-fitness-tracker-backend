-- Reproducible schema for a fresh Supabase project.
-- If your remote project already contains these tables from the SQL Editor,
-- keep this migration in source control as the canonical schema but do not
-- manually re-run it against the same database.

create table if not exists public.fitness_profiles (
  id uuid primary key default gen_random_uuid(),
  auth_user_id uuid unique references auth.users(id) on delete set null,
  display_name text,
  timezone text not null default 'Europe/London',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.body_measurements (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.fitness_profiles(id) on delete cascade,
  measured_on date not null,
  measured_at timestamptz,
  date_precision text not null default 'explicit_date'
    check (date_precision in (
      'exact_timestamp',
      'explicit_date',
      'relative_date_resolved',
      'chat_timestamp_inferred'
    )),
  weight_kg numeric(6,2) check (weight_kg is null or weight_kg > 0),
  height_cm numeric(6,2) check (height_cm is null or height_cm > 0),
  body_fat_percent numeric(5,2)
    check (body_fat_percent is null or body_fat_percent between 0 and 100),
  source_provider text not null default 'manual',
  source_record_id text not null,
  ingested_via text not null default 'manual_entry',
  notes text,
  raw_payload jsonb,
  created_at timestamptz not null default now(),
  unique (profile_id, source_provider, source_record_id)
);

create table if not exists public.workouts (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.fitness_profiles(id) on delete cascade,
  activity_type text not null,
  started_on date not null,
  started_at timestamptz,
  date_precision text not null default 'explicit_date'
    check (date_precision in (
      'exact_timestamp',
      'explicit_date',
      'relative_date_resolved',
      'chat_timestamp_inferred'
    )),
  title text,
  duration_seconds integer check (duration_seconds is null or duration_seconds >= 0),
  moving_duration_seconds integer
    check (moving_duration_seconds is null or moving_duration_seconds >= 0),
  distance_m numeric(12,2) check (distance_m is null or distance_m >= 0),
  active_energy_kcal numeric(10,2)
    check (active_energy_kcal is null or active_energy_kcal >= 0),
  avg_heart_rate_bpm numeric(6,2)
    check (avg_heart_rate_bpm is null or avg_heart_rate_bpm > 0),
  max_heart_rate_bpm numeric(6,2)
    check (max_heart_rate_bpm is null or max_heart_rate_bpm > 0),
  avg_pace_seconds_per_km integer
    check (avg_pace_seconds_per_km is null or avg_pace_seconds_per_km > 0),
  elevation_gain_m numeric(10,2),
  source_provider text not null,
  source_record_id text not null,
  ingested_via text not null,
  notes text,
  raw_payload jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (profile_id, source_provider, source_record_id)
);

create table if not exists public.workout_metric_samples (
  id bigint generated always as identity primary key,
  workout_id uuid not null references public.workouts(id) on delete cascade,
  metric_name text not null,
  sampled_at timestamptz,
  elapsed_seconds integer,
  value numeric not null,
  unit text not null,
  source_provider text not null,
  raw_payload jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.ai_analyses (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.fitness_profiles(id) on delete cascade,
  workout_id uuid references public.workouts(id) on delete cascade,
  analysis_type text not null,
  period_start date,
  period_end date,
  model text,
  prompt_version text,
  summary text,
  result jsonb not null default '{}'::jsonb,
  input_snapshot jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_body_measurements_profile_date
  on public.body_measurements(profile_id, measured_on desc);

create index if not exists idx_workouts_profile_date
  on public.workouts(profile_id, started_on desc);

create index if not exists idx_workouts_activity_type
  on public.workouts(profile_id, activity_type, started_on desc);

create index if not exists idx_workout_metric_samples_workout
  on public.workout_metric_samples(workout_id, metric_name, sampled_at);

create index if not exists idx_ai_analyses_profile
  on public.ai_analyses(profile_id, created_at desc);

alter table public.fitness_profiles enable row level security;
alter table public.body_measurements enable row level security;
alter table public.workouts enable row level security;
alter table public.workout_metric_samples enable row level security;
alter table public.ai_analyses enable row level security;

drop policy if exists "Users can view own fitness profile" on public.fitness_profiles;
create policy "Users can view own fitness profile"
on public.fitness_profiles
for select
using ((select auth.uid()) = auth_user_id);

drop policy if exists "Users can update own fitness profile" on public.fitness_profiles;
create policy "Users can update own fitness profile"
on public.fitness_profiles
for update
using ((select auth.uid()) = auth_user_id)
with check ((select auth.uid()) = auth_user_id);

drop policy if exists "Users can view own body measurements" on public.body_measurements;
create policy "Users can view own body measurements"
on public.body_measurements
for select
using (
  exists (
    select 1
    from public.fitness_profiles p
    where p.id = body_measurements.profile_id
      and p.auth_user_id = (select auth.uid())
  )
);

drop policy if exists "Users can insert own body measurements" on public.body_measurements;
create policy "Users can insert own body measurements"
on public.body_measurements
for insert
with check (
  exists (
    select 1
    from public.fitness_profiles p
    where p.id = body_measurements.profile_id
      and p.auth_user_id = (select auth.uid())
  )
);

drop policy if exists "Users can update own body measurements" on public.body_measurements;
create policy "Users can update own body measurements"
on public.body_measurements
for update
using (
  exists (
    select 1
    from public.fitness_profiles p
    where p.id = body_measurements.profile_id
      and p.auth_user_id = (select auth.uid())
  )
);

drop policy if exists "Users can delete own body measurements" on public.body_measurements;
create policy "Users can delete own body measurements"
on public.body_measurements
for delete
using (
  exists (
    select 1
    from public.fitness_profiles p
    where p.id = body_measurements.profile_id
      and p.auth_user_id = (select auth.uid())
  )
);

drop policy if exists "Users can view own workouts" on public.workouts;
create policy "Users can view own workouts"
on public.workouts
for select
using (
  exists (
    select 1
    from public.fitness_profiles p
    where p.id = workouts.profile_id
      and p.auth_user_id = (select auth.uid())
  )
);

drop policy if exists "Users can insert own workouts" on public.workouts;
create policy "Users can insert own workouts"
on public.workouts
for insert
with check (
  exists (
    select 1
    from public.fitness_profiles p
    where p.id = workouts.profile_id
      and p.auth_user_id = (select auth.uid())
  )
);

drop policy if exists "Users can update own workouts" on public.workouts;
create policy "Users can update own workouts"
on public.workouts
for update
using (
  exists (
    select 1
    from public.fitness_profiles p
    where p.id = workouts.profile_id
      and p.auth_user_id = (select auth.uid())
  )
);

drop policy if exists "Users can delete own workouts" on public.workouts;
create policy "Users can delete own workouts"
on public.workouts
for delete
using (
  exists (
    select 1
    from public.fitness_profiles p
    where p.id = workouts.profile_id
      and p.auth_user_id = (select auth.uid())
  )
);

drop policy if exists "Users can access own workout metric samples" on public.workout_metric_samples;
create policy "Users can access own workout metric samples"
on public.workout_metric_samples
for all
using (
  exists (
    select 1
    from public.workouts w
    join public.fitness_profiles p on p.id = w.profile_id
    where w.id = workout_metric_samples.workout_id
      and p.auth_user_id = (select auth.uid())
  )
)
with check (
  exists (
    select 1
    from public.workouts w
    join public.fitness_profiles p on p.id = w.profile_id
    where w.id = workout_metric_samples.workout_id
      and p.auth_user_id = (select auth.uid())
  )
);

drop policy if exists "Users can access own AI analyses" on public.ai_analyses;
create policy "Users can access own AI analyses"
on public.ai_analyses
for all
using (
  exists (
    select 1
    from public.fitness_profiles p
    where p.id = ai_analyses.profile_id
      and p.auth_user_id = (select auth.uid())
  )
)
with check (
  exists (
    select 1
    from public.fitness_profiles p
    where p.id = ai_analyses.profile_id
      and p.auth_user_id = (select auth.uid())
  )
);
