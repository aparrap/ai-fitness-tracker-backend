import { describe, expect, it } from 'vitest';
import {
  normalizeAppleHealthWeight,
  normalizeAppleHealthWorkout,
  normalizeAppleHealthWorkoutSamples
} from '../src/integrations/apple-health/apple-health.normalizer.js';

describe('Apple Health normalizer', () => {
  it('uses a fixed height of 175 when Apple Health weight has no height', () => {
    const result = normalizeAppleHealthWeight({
      sourceRecordId: 'weight-1',
      measuredAt: '2026-08-14T07:15:00+01:00',
      measuredOn: '2026-08-14',
      weightKg: 102.7
    });

    expect(result.heightCm).toBe(175);
    expect(result.sourceProvider).toBe('apple_health');
  });

  it('keeps the legacy heart-rate payload compatible and derives workout summaries', () => {
    const result = normalizeAppleHealthWorkout({
      sourceRecordId: 'workout-1',
      activityType: 'running',
      startedAt: '2026-08-14T07:00:00+01:00',
      startedOn: '2026-08-14',
      endedAt: '2026-08-14T07:30:00+01:00',
      samples: [],
      heartRateSamples: [
        {
          sourceRecordId: 'hr-1',
          sampledAt: '2026-08-14T07:01:00+01:00',
          bpm: 140
        },
        {
          sourceRecordId: 'hr-2',
          sampledAt: '2026-08-14T07:02:00+01:00',
          bpm: 150
        }
      ]
    });

    expect(result.durationSeconds).toBe(1800);
    expect(result.avgHeartRateBpm).toBe(145);
    expect(result.maxHeartRateBpm).toBe(150);
  });

  it('prefers the richer generic sample when a legacy sample has the same HealthKit UUID', () => {
    const samples = normalizeAppleHealthWorkoutSamples({
      sourceRecordId: 'workout-1',
      activityType: 'running',
      startedAt: '2026-08-14T07:00:00+01:00',
      startedOn: '2026-08-14',
      endedAt: '2026-08-14T07:30:00+01:00',
      heartRateSamples: [
        {
          sourceRecordId: 'hr-1',
          sampledAt: '2026-08-14T07:01:00+01:00',
          bpm: 140
        }
      ],
      samples: [
        {
          sourceRecordId: 'hr-1',
          metric: 'heart_rate',
          sampledAt: '2026-08-14T07:01:00+01:00',
          value: 141,
          unit: 'bpm',
          associationKind: 'time_window',
          aggregation: 'instantaneous',
          sourceName: 'Apple Watch'
        },
        {
          sourceRecordId: 'speed-1',
          metric: 'running_speed',
          sampledAt: '2026-08-14T07:01:00+01:00',
          value: 2.2,
          unit: 'm/s',
          associationKind: 'workout_associated',
          aggregation: 'instantaneous'
        }
      ]
    });

    expect(samples).toHaveLength(2);
    expect(samples.find((sample) => sample.sourceRecordId === 'hr-1')).toMatchObject({
      value: 141,
      associationKind: 'time_window',
      sourceName: 'Apple Watch'
    });
  });
});
