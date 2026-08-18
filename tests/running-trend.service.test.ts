import { describe, expect, it } from 'vitest';
import {
  isWorkoutWithinPastDays,
  linearTrend
} from '../src/modules/fitness-analytics/running-trend.service.js';

describe('running trend statistics', () => {
  it('recognises faster pace at the same HR as an improvement', () => {
    const day = 86_400_000;
    const trend = linearTrend([
      { timestampMs: 0, value: 450 },
      { timestampMs: 7 * day, value: 440 },
      { timestampMs: 14 * day, value: 430 }
    ]);

    expect(trend).not.toBeNull();
    expect(trend?.change).toBe(-20);
    expect(trend?.slopePerWeek).toBeCloseTo(-10, 2);
  });

  it('recognises lower HR at a comparable speed as an improvement', () => {
    const day = 86_400_000;
    const trend = linearTrend([
      { timestampMs: 0, value: 145 },
      { timestampMs: 14 * day, value: 138 }
    ]);

    expect(trend?.change).toBe(-7);
    expect(trend?.slopePerWeek).toBeLessThan(0);
  });

  it('excludes future-dated workouts from rolling windows and PBs', () => {
    const nowMs = Date.parse('2026-08-18T12:00:00Z');
    type Workout = Parameters<typeof isWorkoutWithinPastDays>[0];
    const futureWorkout = {
      started_at: '2026-08-19T12:00:00Z',
      started_on: '2026-08-19'
    } as Workout;
    const recentWorkout = {
      started_at: '2026-08-17T12:00:00Z',
      started_on: '2026-08-17'
    } as Workout;

    expect(isWorkoutWithinPastDays(futureWorkout, nowMs, 90)).toBe(false);
    expect(isWorkoutWithinPastDays(recentWorkout, nowMs, 7)).toBe(true);
  });
});
