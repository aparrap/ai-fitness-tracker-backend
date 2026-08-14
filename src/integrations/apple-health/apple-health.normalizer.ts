import type { CreateWeightInput } from '../../modules/weights/weight.schema.js';
import type { CreateWorkoutInput } from '../../modules/workouts/workout.schema.js';
import type {
  AppleHealthWeightPayload,
  AppleHealthWorkoutPayload
} from './apple-health.schema.js';

function mean(values: number[]): number | undefined {
  if (values.length === 0) return undefined;
  return Math.round(
    (values.reduce((total, value) => total + value, 0) / values.length) * 100
  ) / 100;
}

export function normalizeAppleHealthWeight(
  payload: AppleHealthWeightPayload
): CreateWeightInput {
  return {
    measuredOn: payload.measuredOn,
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
  const derivedDurationSeconds = Math.max(
    0,
    Math.round((ended.getTime() - started.getTime()) / 1000)
  );

  const heartRates = payload.heartRateSamples.map((sample) => sample.bpm);
  const derivedAverageHeartRate = mean(heartRates);
  const derivedMaxHeartRate =
    heartRates.length > 0 ? Math.max(...heartRates) : undefined;

  return {
    activityType: payload.activityType,
    startedOn: payload.startedOn,
    startedAt: payload.startedAt,
    durationSeconds: payload.durationSeconds ?? derivedDurationSeconds,
    sourceProvider: 'apple_health',
    sourceRecordId: payload.sourceRecordId,
    notes: 'Imported from Apple Health',
    ...(payload.title !== undefined ? { title: payload.title } : {}),
    ...(payload.distanceM !== undefined ? { distanceM: payload.distanceM } : {}),
    ...(payload.activeEnergyKcal !== undefined
      ? { activeEnergyKcal: payload.activeEnergyKcal }
      : {}),
    ...(payload.elevationGainM !== undefined
      ? { elevationGainM: payload.elevationGainM }
      : {}),
    ...(payload.avgHeartRateBpm !== undefined
      ? { avgHeartRateBpm: payload.avgHeartRateBpm }
      : derivedAverageHeartRate !== undefined
        ? { avgHeartRateBpm: derivedAverageHeartRate }
        : {}),
    ...(payload.maxHeartRateBpm !== undefined
      ? { maxHeartRateBpm: payload.maxHeartRateBpm }
      : derivedMaxHeartRate !== undefined
        ? { maxHeartRateBpm: derivedMaxHeartRate }
        : {})
  };
}
