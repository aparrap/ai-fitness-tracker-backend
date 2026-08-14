begin;

insert into public.fitness_profiles (
  id,
  display_name,
  timezone
)
values (
  '8d553210-69a8-4f25-91be-000000000001',
  'Andres',
  'Europe/London'
)
on conflict (id)
do update set
  display_name = excluded.display_name,
  timezone = excluded.timezone,
  updated_at = now();

-- ============================================================
-- CANONICAL HISTORICAL BODY MEASUREMENTS
-- Height intentionally fixed at 175 cm for every measurement.
-- ============================================================

insert into public.body_measurements (
  profile_id,
  measured_on,
  date_precision,
  weight_kg,
  height_cm,
  source_provider,
  source_record_id,
  ingested_via,
  notes
)
values
  (
    '8d553210-69a8-4f25-91be-000000000001',
    '2025-05-12',
    'chat_timestamp_inferred',
    108.00,
    175.00,
    'manual',
    'chatgpt-weight-2025-05-12',
    'chatgpt_history',
    'Historical weight recovered from previous ChatGPT fitness conversation.'
  ),
  (
    '8d553210-69a8-4f25-91be-000000000001',
    '2026-01-05',
    'chat_timestamp_inferred',
    111.00,
    175.00,
    'manual',
    'chatgpt-weight-2026-01-05',
    'chatgpt_history',
    'Historical weight recovered from previous ChatGPT fitness conversation.'
  ),
  (
    '8d553210-69a8-4f25-91be-000000000001',
    '2026-07-18',
    'chat_timestamp_inferred',
    106.00,
    175.00,
    'manual',
    'chatgpt-weight-2026-07-18',
    'chatgpt_history',
    'Starting weight from the fitness-tracker conversation.'
  ),
  (
    '8d553210-69a8-4f25-91be-000000000001',
    '2026-07-20',
    'explicit_date',
    106.00,
    175.00,
    'manual',
    'chatgpt-weight-2026-07-20',
    'chatgpt_history',
    'Historical ChatGPT weight log.'
  ),
  (
    '8d553210-69a8-4f25-91be-000000000001',
    '2026-07-22',
    'chat_timestamp_inferred',
    105.40,
    175.00,
    'manual',
    'chatgpt-weight-2026-07-22',
    'chatgpt_history',
    'Historical ChatGPT weight log.'
  ),
  (
    '8d553210-69a8-4f25-91be-000000000001',
    '2026-07-27',
    'explicit_date',
    104.90,
    175.00,
    'manual',
    'chatgpt-weight-2026-07-27',
    'chatgpt_history',
    'Historical ChatGPT weight log.'
  ),
  (
    '8d553210-69a8-4f25-91be-000000000001',
    '2026-07-28',
    'explicit_date',
    104.00,
    175.00,
    'manual',
    'chatgpt-weight-2026-07-28',
    'chatgpt_history',
    'Historical ChatGPT weight log.'
  ),
  (
    '8d553210-69a8-4f25-91be-000000000001',
    '2026-08-01',
    'explicit_date',
    103.80,
    175.00,
    'manual',
    'chatgpt-weight-2026-08-01',
    'chatgpt_history',
    'Historical ChatGPT weight log.'
  ),
  (
    '8d553210-69a8-4f25-91be-000000000001',
    '2026-08-04',
    'explicit_date',
    103.50,
    175.00,
    'manual',
    'chatgpt-weight-2026-08-04',
    'chatgpt_history',
    'Historical ChatGPT weight log.'
  ),
  (
    '8d553210-69a8-4f25-91be-000000000001',
    '2026-08-08',
    'explicit_date',
    102.70,
    175.00,
    'manual',
    'chatgpt-weight-2026-08-08',
    'chatgpt_history',
    'Historical ChatGPT weight log.'
  )
on conflict (
  profile_id,
  source_provider,
  source_record_id
)
do update set
  measured_on = excluded.measured_on,
  date_precision = excluded.date_precision,
  weight_kg = excluded.weight_kg,
  height_cm = excluded.height_cm,
  ingested_via = excluded.ingested_via,
  notes = excluded.notes;

-- ============================================================
-- CANONICAL HISTORICAL RUNNING DATA
-- ============================================================

insert into public.workouts (
  profile_id,
  activity_type,
  started_on,
  date_precision,
  title,
  duration_seconds,
  distance_m,
  active_energy_kcal,
  avg_heart_rate_bpm,
  avg_pace_seconds_per_km,
  source_provider,
  source_record_id,
  ingested_via,
  notes
)
values
  (
    '8d553210-69a8-4f25-91be-000000000001',
    'running',
    '2026-07-22',
    'explicit_date',
    'Interval run',
    1800,
    3970,
    423,
    149,
    459,
    'adidas_running',
    'chatgpt-adidas-run-2026-07-22',
    'chatgpt_history',
    'Historical completed interval run supplied through ChatGPT.'
  ),
  (
    '8d553210-69a8-4f25-91be-000000000001',
    'running',
    '2026-07-24',
    'explicit_date',
    'Interval run',
    1860,
    4000,
    435,
    151,
    460,
    'adidas_running',
    'chatgpt-adidas-run-2026-07-24',
    'chatgpt_history',
    'Historical completed interval run supplied through ChatGPT.'
  ),
  (
    '8d553210-69a8-4f25-91be-000000000001',
    'running',
    '2026-07-31',
    'relative_date_resolved',
    'Running workout',
    2040,
    4690,
    null,
    142,
    435,
    'adidas_running',
    'chatgpt-adidas-run-2026-07-31',
    'chatgpt_history',
    'Retained from the previously accepted seed data.'
  ),
  (
    '8d553210-69a8-4f25-91be-000000000001',
    'running',
    '2026-08-11',
    'explicit_date',
    'Running workout',
    2260,
    4750,
    534,
    145,
    475,
    'adidas_running',
    'chatgpt-adidas-run-2026-08-11',
    'chatgpt_history',
    'Historical adidas Running workout supplied through ChatGPT.'
  ),
  (
    '8d553210-69a8-4f25-91be-000000000001',
    'running',
    '2026-08-12',
    'explicit_date',
    'Running workout',
    2105,
    4600,
    517,
    144,
    458,
    'adidas_running',
    'chatgpt-adidas-run-2026-08-12',
    'chatgpt_history',
    'Historical adidas Running workout supplied through ChatGPT.'
  ),
  (
    '8d553210-69a8-4f25-91be-000000000001',
    'running',
    '2026-08-14',
    'explicit_date',
    'Running workout',
    2284,
    5240,
    586,
    154,
    435,
    'adidas_running',
    'chatgpt-adidas-run-2026-08-14',
    'chatgpt_history',
    'Historical adidas Running workout supplied through ChatGPT.'
  )
on conflict (
  profile_id,
  source_provider,
  source_record_id
)
do update set
  started_on = excluded.started_on,
  date_precision = excluded.date_precision,
  title = excluded.title,
  duration_seconds = excluded.duration_seconds,
  distance_m = excluded.distance_m,
  active_energy_kcal = excluded.active_energy_kcal,
  avg_heart_rate_bpm = excluded.avg_heart_rate_bpm,
  avg_pace_seconds_per_km = excluded.avg_pace_seconds_per_km,
  ingested_via = excluded.ingested_via,
  notes = excluded.notes,
  updated_at = now();

commit;
