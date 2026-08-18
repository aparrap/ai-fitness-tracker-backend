begin;

-- ============================================================
-- METRIC SAMPLE INTEGRITY
--
-- Makes sample aggregation a first-class property and enforces
-- one distance aggregation mode per workout across separate syncs.
-- ============================================================

alter table public.workout_metric_samples
  add column if not exists aggregation text;

update public.workout_metric_samples
set aggregation = raw_payload ->> 'aggregation'
where aggregation is null
  and jsonb_typeof(raw_payload) = 'object'
  and raw_payload ? 'aggregation';

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conrelid = 'public.workout_metric_samples'::regclass
      and conname = 'workout_metric_samples_aggregation_check'
  ) then
    alter table public.workout_metric_samples
      add constraint workout_metric_samples_aggregation_check
      check (
        aggregation is null
        or aggregation in ('instantaneous', 'interval_delta', 'cumulative')
      );
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conrelid = 'public.workout_metric_samples'::regclass
      and conname = 'workout_metric_samples_metric_aggregation_check'
  ) then
    alter table public.workout_metric_samples
      add constraint workout_metric_samples_metric_aggregation_check
      check (
        aggregation is null
        or (metric_name in (
          'heart_rate',
          'running_speed',
          'running_power',
          'running_stride_length',
          'running_vertical_oscillation',
          'running_ground_contact_time'
        ) and aggregation = 'instantaneous')
        or (metric_name = 'distance' and aggregation in ('interval_delta', 'cumulative'))
        or (metric_name in ('active_energy', 'step_count') and aggregation = 'interval_delta')
      );
  end if;
end
$$;

create or replace function public.enforce_workout_distance_aggregation()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
begin
  if new.metric_name <> 'distance' or new.aggregation is null then
    return new;
  end if;

  -- Serialize distance-series writes per workout so two concurrent syncs cannot
  -- both establish different aggregation modes before either transaction commits.
  perform pg_advisory_xact_lock(
    hashtextextended(new.workout_id::text || ':distance-aggregation', 0)
  );

  if exists (
    select 1
    from public.workout_metric_samples existing
    where existing.workout_id = new.workout_id
      and existing.metric_name = 'distance'
      and existing.aggregation is not null
      and existing.aggregation <> new.aggregation
      and existing.id <> coalesce(new.id, -1)
  ) then
    raise exception
      'Workout % already contains distance samples using a different aggregation mode',
      new.workout_id;
  end if;

  return new;
end;
$$;

drop trigger if exists trg_workout_distance_aggregation
  on public.workout_metric_samples;

create trigger trg_workout_distance_aggregation
before insert or update of workout_id, metric_name, aggregation
on public.workout_metric_samples
for each row
execute function public.enforce_workout_distance_aggregation();

commit;
