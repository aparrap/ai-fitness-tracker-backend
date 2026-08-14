-- Run after the first Apple Health sync.

-- 1) Recent syncs
select
  client_sync_id,
  status,
  weights_processed,
  workouts_processed,
  workouts_matched,
  metric_samples_processed,
  started_at,
  completed_at,
  error_message
from public.data_syncs
where profile_id = '8d553210-69a8-4f25-91be-000000000001'
  and provider = 'apple_health'
order by started_at desc
limit 20;

-- 2) Workouts that have an Apple Health source link
select
  w.id,
  w.started_on,
  w.started_at,
  w.activity_type,
  round(w.distance_m / 1000.0, 2) as distance_km,
  w.duration_seconds,
  w.avg_heart_rate_bpm,
  w.max_heart_rate_bpm,
  l.source_record_id as apple_health_uuid
from public.workouts w
join public.workout_source_links l
  on l.workout_id = w.id
where w.profile_id = '8d553210-69a8-4f25-91be-000000000001'
  and l.source_provider = 'apple_health'
order by w.started_on desc, w.started_at desc nulls last;

-- 3) Heart-rate sample counts by workout
select
  w.id as workout_id,
  w.started_on,
  w.activity_type,
  count(s.id) as heart_rate_sample_count,
  round(avg(s.value), 1) as sample_avg_bpm,
  max(s.value) as sample_max_bpm
from public.workouts w
join public.workout_metric_samples s
  on s.workout_id = w.id
where w.profile_id = '8d553210-69a8-4f25-91be-000000000001'
  and s.metric_name = 'heart_rate'
group by w.id, w.started_on, w.activity_type
order by w.started_on desc;
