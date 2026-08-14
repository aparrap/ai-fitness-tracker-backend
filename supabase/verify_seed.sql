-- AI Fitness Tracker seed reconciliation.
-- Run this in Supabase SQL Editor.
-- A correct seed returns ZERO rows from both result sets.

-- ============================================================
-- EXPECTED WEIGHTS vs DATABASE
-- ============================================================

with expected_weights(measured_on, weight_kg, height_cm) as (
  values
    ('2025-05-12'::date, 108.00::numeric, 175.00::numeric),
    ('2026-01-05'::date, 111.00::numeric, 175.00::numeric),
    ('2026-07-18'::date, 106.00::numeric, 175.00::numeric),
    ('2026-07-20'::date, 106.00::numeric, 175.00::numeric),
    ('2026-07-22'::date, 105.40::numeric, 175.00::numeric),
    ('2026-07-27'::date, 104.90::numeric, 175.00::numeric),
    ('2026-07-28'::date, 104.00::numeric, 175.00::numeric),
    ('2026-08-01'::date, 103.80::numeric, 175.00::numeric),
    ('2026-08-04'::date, 103.50::numeric, 175.00::numeric),
    ('2026-08-08'::date, 102.70::numeric, 175.00::numeric)
)
select
  'missing_or_mismatched_weight' as issue,
  e.measured_on,
  e.weight_kg as expected_weight_kg,
  b.weight_kg as actual_weight_kg,
  e.height_cm as expected_height_cm,
  b.height_cm as actual_height_cm
from expected_weights e
left join public.body_measurements b
  on b.profile_id = '8d553210-69a8-4f25-91be-000000000001'
 and b.measured_on = e.measured_on
 and b.weight_kg = e.weight_kg
 and b.height_cm = e.height_cm
where b.id is null
order by e.measured_on;

-- ============================================================
-- EXPECTED RUNS vs DATABASE
-- ============================================================

with expected_runs(
  started_on,
  duration_seconds,
  distance_m,
  active_energy_kcal,
  avg_heart_rate_bpm,
  avg_pace_seconds_per_km
) as (
  values
    ('2026-07-22'::date, 1800, 3970::numeric, 423::numeric, 149::numeric, 459),
    ('2026-07-24'::date, 1860, 4000::numeric, 435::numeric, 151::numeric, 460),
    ('2026-07-31'::date, 2040, 4690::numeric, null::numeric, 142::numeric, 435),
    ('2026-08-11'::date, 2260, 4750::numeric, 534::numeric, 145::numeric, 475),
    ('2026-08-12'::date, 2105, 4600::numeric, 517::numeric, 144::numeric, 458),
    ('2026-08-14'::date, 2284, 5240::numeric, 586::numeric, 154::numeric, 435)
)
select
  'missing_or_mismatched_run' as issue,
  e.started_on,
  e.duration_seconds as expected_duration_seconds,
  w.duration_seconds as actual_duration_seconds,
  e.distance_m as expected_distance_m,
  w.distance_m as actual_distance_m,
  e.active_energy_kcal as expected_kcal,
  w.active_energy_kcal as actual_kcal,
  e.avg_heart_rate_bpm as expected_hr,
  w.avg_heart_rate_bpm as actual_hr,
  e.avg_pace_seconds_per_km as expected_pace,
  w.avg_pace_seconds_per_km as actual_pace
from expected_runs e
left join public.workouts w
  on w.profile_id = '8d553210-69a8-4f25-91be-000000000001'
 and w.activity_type = 'running'
 and w.started_on = e.started_on
 and w.duration_seconds is not distinct from e.duration_seconds
 and w.distance_m is not distinct from e.distance_m
 and w.active_energy_kcal is not distinct from e.active_energy_kcal
 and w.avg_heart_rate_bpm is not distinct from e.avg_heart_rate_bpm
 and w.avg_pace_seconds_per_km is not distinct from e.avg_pace_seconds_per_km
where w.id is null
order by e.started_on;
