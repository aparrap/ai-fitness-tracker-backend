import type { CreateWeightInput } from '../../modules/weights/weight.schema.js';
import type { CreateWorkoutInput } from '../../modules/workouts/workout.schema.js';
import type {
  AppleHealthWeightPayload,
  AppleHealthWorkoutPayload,
  AppleHealthWorkoutSamplePayload
} from './apple-health.schema.js';

function mean(values: number[]): number | undefined {
  if (values.length === 0) return undefined;
  return Math.round(
    (values.reduce((total, value) => total + value, 0) / values.length) * 100
  ) / 100;
}

function aggregateTotal(
  samples: AppleHealthWorkoutSamplePayload[],
  metric: 'distance' | 'active_energy'
): number | undefined {
  const matching = samples.filter((sample) => sample.metric === metric);
  if (matching.length === 0) return undefined;

  if (metric === 'distance' && matching[0]!.aggregation === 'cumulative') {
    return Math.max(...matching.map((sample) => sample.value));
  }

  return matching.reduce((total, sample) => total + sample.value, 0);
}

export function normalizeAppleHealthWorkoutSamples(
  payload: AppleHealthWorkoutPayload
): AppleHealthWorkoutSamplePayload[] {
  const bySourceRecordId = new Map<string, AppleHealthWorkoutSamplePayload>();

  // Load legacy samples first. If the new generic payload contains the same HealthKit UUID,
  // the richer generic representation wins below.
  for (const sample of payload.heartRateSamples) {
    bySourceRecordId.set(sample.sourceRecordId, {
      sourceRecordId: sample.sourceRecordId,
      metric: 'heart_rate',
      sampledAt: sample.sampledAt,
      value: sample.bpm,
      unit: 'bpm',
      associationKind: 'workout_associated',
      aggregation: 'instantaneous'
    });
  }

  for (const sample of payload.samples) {
    bySourceRecordId.set(sample.sourceRecordId, sample);
  }

  return [...bySourceRecordId.values()].sort(
    (left, right) =>
      new Date(left.sampledAt).getTime() - new Date(right.sampledAt).getTime()
  );
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
  const normalizedSamples = normalizeAppleHealthWorkoutSamples(payload);

  const heartRates = normalizedSamples
    .filter((sample) => sample.metric === 'heart_rate')
    .map((sample) => sample.value);
  const derivedAverageHeartRate = mean(heartRates);
  const derivedMaxHeartRate =
    heartRates.length > 0 ? Math.max(...heartRates) : undefined;
  const derivedDistanceM = aggregateTotal(normalizedSamples, 'distance');
  const derivedActiveEnergyKcal = aggregateTotal(normalizedSamples, 'active_energy');

  return {
    activityType: payload.activityType,
    startedOn: payload.startedOn,
    startedAt: payload.startedAt,
    durationSeconds: payload.durationSeconds ?? derivedDurationSeconds,
    sourceProvider: 'apple_health',
    sourceRecordId: payload.sourceRecordId,
    notes: payload.sourceName
      ? `Imported from Apple Health (${payload.sourceName})`
      : 'Imported from Apple Health',
    ...(payload.title !== undefined ? { title: payload.title } : {}),
    ...(payload.distanceM !== undefined
      ? { distanceM: payload.distanceM }
      : derivedDistanceM !== undefined
        ? { distanceM: derivedDistanceM }
        : {}),
    ...(payload.activeEnergyKcal !== undefined
      ? { activeEnergyKcal: payload.activeEnergyKcal }
      : derivedActiveEnergyKcal !== undefined
        ? { activeEnergyKcal: derivedActiveEnergyKcal }
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
