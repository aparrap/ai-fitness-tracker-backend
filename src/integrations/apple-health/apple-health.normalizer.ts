import type {
  AppleHealthWeightPayload,
  AppleHealthWorkoutPayload
} from './apple-health.types.js';
import type { CreateWeightInput } from '../../modules/weights/weight.schema.js';
import type { CreateWorkoutInput } from '../../modules/workouts/workout.schema.js';

export function normalizeAppleHealthWeight(
  payload: AppleHealthWeightPayload
): CreateWeightInput {
  return {
    measuredOn: payload.measuredAt.slice(0, 10),
    measuredAt: payload.measuredAt,
    weightKg: payload.weightKg,
    heightCm: payload.heightCm ?? 175,
    sourceProvider: 'apple_health',
    sourceRecordId: payload.sourceRecordId,
    notes: 'Imported from Apple Health'
  };
}

export function normalizeAppleHealthWorkout(
  payload: AppleHealthWorkoutPayload
): CreateWorkoutInput {
  const started = new Date(payload.startedAt);
  const ended = new Date(payload.endedAt);
  const durationSeconds = Math.max(
    0,
    Math.round((ended.getTime() - started.getTime()) / 1000)
  );

  return {
    activityType: payload.activityType,
    startedOn: payload.startedAt.slice(0, 10),
    startedAt: payload.startedAt,
    durationSeconds,
    sourceProvider: 'apple_health',
    sourceRecordId: payload.sourceRecordId,
    notes: 'Imported from Apple Health',
    ...(payload.distanceM !== undefined ? { distanceM: payload.distanceM } : {}),
    ...(payload.activeEnergyKcal !== undefined
      ? { activeEnergyKcal: payload.activeEnergyKcal }
      : {}),
    ...(payload.avgHeartRateBpm !== undefined
      ? { avgHeartRateBpm: payload.avgHeartRateBpm }
      : {}),
    ...(payload.maxHeartRateBpm !== undefined
      ? { maxHeartRateBpm: payload.maxHeartRateBpm }
      : {})
  };
}
