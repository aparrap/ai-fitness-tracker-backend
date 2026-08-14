import { describe, expect, it } from 'vitest';
import { derivePaceSecondsPerKm } from '../src/modules/workouts/workout.service.js';

describe('derivePaceSecondsPerKm', () => {
  it('derives pace from duration and distance', () => {
    expect(derivePaceSecondsPerKm(2284, 5240)).toBe(436);
  });

  it('returns null when distance is missing', () => {
    expect(derivePaceSecondsPerKm(2284, undefined)).toBeNull();
  });

  it('returns null when duration is missing', () => {
    expect(derivePaceSecondsPerKm(undefined, 5240)).toBeNull();
  });
});
