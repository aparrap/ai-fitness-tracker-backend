begin;

-- ============================================================
-- APPLE HEALTH + MULTI-SOURCE WORKOUT INGESTION SUPPORT
-- ============================================================

-- High-resolution samples need provider IDs for idempotent upserts.
alter table public.workout_metric_samples
  add column if not exists source_record_id text;

update public.workout_metric_samples
set source_record_id = 'legacy-' || id::text
where source_record_id is null;

alter table public.workout_metric_samples
  alter column source_record_id set not null;

create unique index if not exists uq_workout_metric_samples_source_record
  on public.workout_metric_samples(source_provider, source_record_id);

-- One canonical workout may be represented by several providers:
-- historical ChatGPT/adidas seed, Apple Health, and eventually direct adidas import.
create table if not exists public.workout_source_links (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null
    references public.fitness_profiles(id)
    on delete cascade,
  workout_id uuid not null
    references public.workouts(id)
    on delete cascade,
  source_provider text not null,
  source_record_id text not null,
  raw_payload jsonb,
  created_at timestamptz not null default now(),
  unique (profile_id, source_provider, source_record_id)
);

create index if not exists idx_workout_source_links_workout
  on public.workout_source_links(workout_id);

create index if not exists idx_workout_source_links_profile_provider
  on public.workout_source_links(profile_id, source_provider);

-- Backfill every existing workout's original source as a link.
insert into public.workout_source_links (
  profile_id,
  workout_id,
  source_provider,
  source_record_id,
  raw_payload
)
select
  profile_id,
  id,
  source_provider,
  source_record_id,
  raw_payload
from public.workouts
on conflict (profile_id, source_provider, source_record_id)
do nothing;

-- Tracks phone-to-server batches. client_sync_id makes retrying a whole
-- request safe after timeouts/cold starts.
create table if not exists public.data_syncs (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null
    references public.fitness_profiles(id)
    on delete cascade,
  provider text not null,
  client_sync_id text not null,
  status text not null
    check (status in ('processing', 'completed', 'failed')),
  weights_processed integer not null default 0
    check (weights_processed >= 0),
  workouts_processed integer not null default 0
    check (workouts_processed >= 0),
  workouts_matched integer not null default 0
    check (workouts_matched >= 0),
  metric_samples_processed integer not null default 0
    check (metric_samples_processed >= 0),
  device_metadata jsonb,
  error_message text,
  started_at timestamptz not null default now(),
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (profile_id, provider, client_sync_id)
);

create index if not exists idx_data_syncs_profile_provider_started
  on public.data_syncs(profile_id, provider, started_at desc);

alter table public.workout_source_links enable row level security;
alter table public.data_syncs enable row level security;

drop policy if exists "Users can access own workout source links"
  on public.workout_source_links;

create policy "Users can access own workout source links"
on public.workout_source_links
for all
using (
  exists (
    select 1
    from public.fitness_profiles p
    where p.id = workout_source_links.profile_id
      and p.auth_user_id = (select auth.uid())
  )
)
with check (
  exists (
    select 1
    from public.fitness_profiles p
    where p.id = workout_source_links.profile_id
      and p.auth_user_id = (select auth.uid())
  )
);

drop policy if exists "Users can access own data syncs" on public.data_syncs;

create policy "Users can access own data syncs"
on public.data_syncs
for all
using (
  exists (
    select 1
    from public.fitness_profiles p
    where p.id = data_syncs.profile_id
      and p.auth_user_id = (select auth.uid())
  )
)
with check (
  exists (
    select 1
    from public.fitness_profiles p
    where p.id = data_syncs.profile_id
      and p.auth_user_id = (select auth.uid())
  )
);

commit;
