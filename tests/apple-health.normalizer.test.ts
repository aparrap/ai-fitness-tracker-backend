import { describe, expect, it } from 'vitest';
import {
  normalizeAppleHealthWeight,
  normalizeAppleHealthWorkout
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

  it('derives workout duration and heart-rate summary from samples', () => {
    const result = normalizeAppleHealthWorkout({
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
});
