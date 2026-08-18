import { describe, expect, it } from 'vitest';
import { normalizeAppleHealthWorkout } from '../src/integrations/apple-health/apple-health.normalizer.js';
import { appleHealthWorkoutSchema } from '../src/integrations/apple-health/apple-health.schema.js';

describe('Apple Health workout integrity', () => {
  it('rejects metric samples that do not overlap their workout', () => {
    const result = appleHealthWorkoutSchema.safeParse({
      sourceRecordId: 'workout-1',
      activityType: 'running',
      startedAt: '2026-08-14T07:00:00Z',
      startedOn: '2026-08-14',
      endedAt: '2026-08-14T07:30:00Z',
      samples: [
        {
          sourceRecordId: 'hr-outside',
          metric: 'heart_rate',
          sampledAt: '2026-08-14T08:00:00Z',
          value: 145,
          unit: 'bpm',
          associationKind: 'workout_associated',
          aggregation: 'instantaneous'
        }
      ]
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(
        result.error.issues.some(
          (issue) => issue.path[0] === 'samples' && issue.path.at(-1) === 'sampledAt'
        )
      ).toBe(true);
    }
  });

  it('derives workout distance and energy totals from interval samples', () => {
    const payload = appleHealthWorkoutSchema.parse({
      sourceRecordId: 'workout-derived-totals',
      activityType: 'running',
      startedAt: '2026-08-14T07:00:00Z',
      startedOn: '2026-08-14',
      endedAt: '2026-08-14T07:01:00Z',
      samples: [
        {
          sourceRecordId: 'distance-1',
          metric: 'distance',
          sampledAt: '2026-08-14T07:00:00Z',
          sampleEndedAt: '2026-08-14T07:00:30Z',
          value: 100,
          unit: 'm',
          associationKind: 'workout_associated',
          aggregation: 'interval_delta'
        },
        {
          sourceRecordId: 'distance-2',
          metric: 'distance',
          sampledAt: '2026-08-14T07:00:30Z',
          sampleEndedAt: '2026-08-14T07:01:00Z',
          value: 120,
          unit: 'm',
          associationKind: 'workout_associated',
          aggregation: 'interval_delta'
        },
        {
          sourceRecordId: 'energy-1',
          metric: 'active_energy',
          sampledAt: '2026-08-14T07:00:00Z',
          sampleEndedAt: '2026-08-14T07:01:00Z',
          value: 15,
          unit: 'kcal',
          associationKind: 'workout_associated',
          aggregation: 'interval_delta'
        }
      ]
    });

    const normalized = normalizeAppleHealthWorkout(payload);
    expect(normalized.distanceM).toBe(220);
    expect(normalized.activeEnergyKcal).toBe(15);
  });

  it('derives cumulative distance from the highest cumulative observation', () => {
    const payload = appleHealthWorkoutSchema.parse({
      sourceRecordId: 'workout-cumulative',
      activityType: 'running',
      startedAt: '2026-08-14T07:00:00Z',
      startedOn: '2026-08-14',
      endedAt: '2026-08-14T07:01:00Z',
      samples: [
        {
          sourceRecordId: 'distance-1',
          metric: 'distance',
          sampledAt: '2026-08-14T07:00:00Z',
          value: 0,
          unit: 'm',
          associationKind: 'workout_associated',
          aggregation: 'cumulative'
        },
        {
          sourceRecordId: 'distance-2',
          metric: 'distance',
          sampledAt: '2026-08-14T07:01:00Z',
          value: 220,
          unit: 'm',
          associationKind: 'workout_associated',
          aggregation: 'cumulative'
        }
      ]
    });

    expect(normalizeAppleHealthWorkout(payload).distanceM).toBe(220);
  });
});
