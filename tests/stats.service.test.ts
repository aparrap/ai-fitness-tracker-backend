import { describe, expect, it } from 'vitest';
import { buildFitnessSummary } from '../src/modules/stats/stats.service.js';
import type { Database } from '../src/types/database.types.js';

type WeightRow = Database['public']['Tables']['body_measurements']['Row'];
type WorkoutRow = Database['public']['Tables']['workouts']['Row'];

function weight(date: string, kg: number): WeightRow {
  return {
    id: crypto.randomUUID(),
    profile_id: 'profile',
    measured_on: date,
    measured_at: null,
    date_precision: 'explicit_date',
    weight_kg: kg,
    height_cm: 175,
    body_fat_percent: null,
    source_provider: 'manual',
    source_record_id: date,
    ingested_via: 'test',
    notes: null,
    raw_payload: null,
    created_at: new Date().toISOString()
  };
}

function run(
  date: string,
  distanceM: number,
  durationSeconds: number,
  pace: number,
  hr: number
): WorkoutRow {
  const now = new Date().toISOString();

  return {
    id: crypto.randomUUID(),
    profile_id: 'profile',
    activity_type: 'running',
    started_on: date,
    started_at: null,
    date_precision: 'explicit_date',
    title: 'Run',
    duration_seconds: durationSeconds,
    moving_duration_seconds: null,
    distance_m: distanceM,
    active_energy_kcal: null,
    avg_heart_rate_bpm: hr,
    max_heart_rate_bpm: null,
    avg_pace_seconds_per_km: pace,
    elevation_gain_m: null,
    source_provider: 'manual',
    source_record_id: date,
    ingested_via: 'test',
    notes: null,
    raw_payload: null,
    deleted_at: null,
    created_at: now,
    updated_at: now
  };
}

describe('buildFitnessSummary', () => {
  it('summarises weights and runs', () => {
    const summary = buildFitnessSummary(
      [weight('2026-08-08', 102.7), weight('2026-08-04', 103.5)],
      [
        run('2026-08-14', 5240, 2284, 435, 154),
        run('2026-08-12', 4600, 2105, 458, 144)
      ]
    );

    expect(summary.latestWeightKg).toBe(102.7);
    expect(summary.weightChangeFromPreviousKg).toBe(-0.8);
    expect(summary.running.workoutCount).toBe(2);
    expect(summary.running.totalDistanceKm).toBe(9.84);
    expect(summary.running.averageHeartRateBpm).toBe(149);
  });
});
