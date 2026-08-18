import { describe, expect, it } from 'vitest';
import {
  normalizeAppleHealthWeight,
  normalizeAppleHealthWorkout,
  normalizeAppleHealthWorkoutSamples
} from '../src/integrations/apple-health/apple-health.normalizer.js';
import {
  appleHealthWorkoutSampleSchema,
  appleHealthWorkoutSchema
} from '../src/integrations/apple-health/apple-health.schema.js';

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

  it('rejects non-canonical units before analysis', () => {
    const result = appleHealthWorkoutSampleSchema.safeParse({
      sourceRecordId: 'speed-1',
      metric: 'running_speed',
      sampledAt: '2026-08-14T07:01:00+01:00',
      value: 8,
      unit: 'km/h',
      associationKind: 'workout_associated'
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues.some((issue) => issue.path[0] === 'unit')).toBe(true);
    }
  });

  it('rejects implausibly large quantitative samples', () => {
    const result = appleHealthWorkoutSampleSchema.safeParse({
      sourceRecordId: 'distance-1',
      metric: 'distance',
      sampledAt: '2026-08-14T07:01:00+01:00',
      value: 1e12,
      unit: 'm',
      associationKind: 'workout_associated',
      aggregation: 'interval_delta'
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues.some((issue) => issue.path[0] === 'value')).toBe(true);
    }
  });

  it('rejects mixed distance aggregation modes within one workout', () => {
    const result = appleHealthWorkoutSchema.safeParse({
      sourceRecordId: 'workout-mixed-distance',
      activityType: 'running',
      startedAt: '2026-08-14T07:00:00+01:00',
      startedOn: '2026-08-14',
      endedAt: '2026-08-14T07:30:00+01:00',
      samples: [
        {
          sourceRecordId: 'distance-delta',
          metric: 'distance',
          sampledAt: '2026-08-14T07:01:00+01:00',
          sampleEndedAt: '2026-08-14T07:01:10+01:00',
          value: 25,
          unit: 'm',
          aggregation: 'interval_delta'
        },
        {
          sourceRecordId: 'distance-cumulative',
          metric: 'distance',
          sampledAt: '2026-08-14T07:01:10+01:00',
          value: 50,
          unit: 'm',
          aggregation: 'cumulative'
        }
      ]
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues.some((issue) => issue.path[0] === 'samples')).toBe(true);
    }
  });

  it('rejects timestamp spans longer than seven days even when durationSeconds is omitted', () => {
    const result = appleHealthWorkoutSchema.safeParse({
      sourceRecordId: 'workout-too-long',
      activityType: 'running',
      startedAt: '2026-08-01T07:00:00+01:00',
      startedOn: '2026-08-01',
      endedAt: '2026-08-09T07:00:01+01:00',
      samples: []
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues.some((issue) => issue.path[0] === 'endedAt')).toBe(true);
    }
  });
});
