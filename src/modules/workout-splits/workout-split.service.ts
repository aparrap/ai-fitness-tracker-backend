import type { Database, Json } from '../../types/database.types.js';
import type { WorkoutService } from '../workouts/workout.service.js';
import type { WorkoutMetricRepository } from '../workout-metrics/workout-metric.repository.js';
import type { WorkoutSplitRepository } from './workout-split.repository.js';

type MetricRow = Database['public']['Tables']['workout_metric_samples']['Row'];
type WorkoutRow = Database['public']['Tables']['workouts']['Row'];
type SplitInsert = Database['public']['Tables']['workout_splits']['Insert'];

type DistancePoint = {
  timestampMs: number;
  distanceM: number;
};

type DistanceTimeline = {
  points: DistancePoint[];
  source: string;
};

function timestamp(value: string | null): number | null {
  if (!value) return null;
  const parsed = new Date(value).getTime();
  return Number.isFinite(parsed) ? parsed : null;
}

function aggregationOf(sample: MetricRow): string | undefined {
  const raw = sample.raw_payload;
  if (!raw || Array.isArray(raw) || typeof raw !== 'object') return undefined;
  const aggregation = (raw as { aggregation?: Json }).aggregation;
  return typeof aggregation === 'string' ? aggregation : undefined;
}

function uniqueMonotonicPoints(points: DistancePoint[]): DistancePoint[] {
  const ordered = [...points].sort((a, b) => a.timestampMs - b.timestampMs);
  const result: DistancePoint[] = [];

  for (const point of ordered) {
    const previous = result.at(-1);
    if (previous?.timestampMs === point.timestampMs) {
      previous.distanceM = Math.max(previous.distanceM, point.distanceM);
      continue;
    }

    result.push({
      timestampMs: point.timestampMs,
      distanceM: Math.max(previous?.distanceM ?? 0, point.distanceM)
    });
  }

  return result;
}

export function buildDistanceTimeline(
  workout: Pick<WorkoutRow, 'started_at'>,
  metrics: MetricRow[]
): DistanceTimeline | null {
  const workoutStartMs = timestamp(workout.started_at);
  const distanceSamples = metrics
    .filter((sample) => sample.metric_name === 'distance' && sample.value >= 0)
    .filter((sample) => timestamp(sample.sampled_at) !== null)
    .sort(
      (a, b) =>
        (timestamp(a.sampled_at) ?? 0) - (timestamp(b.sampled_at) ?? 0)
    );

  if (distanceSamples.length > 0) {
    const points: DistancePoint[] = [];
    let cumulativeDistance = 0;

    if (workoutStartMs !== null) {
      points.push({ timestampMs: workoutStartMs, distanceM: 0 });
    }

    for (const sample of distanceSamples) {
      const sampleTime = timestamp(sample.sample_ended_at) ?? timestamp(sample.sampled_at);
      if (sampleTime === null) continue;

      if (aggregationOf(sample) === 'cumulative') {
        cumulativeDistance = Math.max(cumulativeDistance, sample.value);
      } else {
        // HealthKit distance quantity samples are interval quantities. The iOS bridge can
        // explicitly send aggregation=interval_delta; this remains the safe default.
        cumulativeDistance += sample.value;
      }

      points.push({ timestampMs: sampleTime, distanceM: cumulativeDistance });
    }

    const normalized = uniqueMonotonicPoints(points);
    if (normalized.length >= 2) {
      return { points: normalized, source: 'healthkit_distance' };
    }
  }

  const speedSamples = metrics
    .filter((sample) => sample.metric_name === 'running_speed' && sample.value >= 0)
    .map((sample) => ({
      timestampMs: timestamp(sample.sampled_at),
      speedMps: sample.value
    }))
    .filter(
      (sample): sample is { timestampMs: number; speedMps: number } =>
        sample.timestampMs !== null
    )
    .sort((a, b) => a.timestampMs - b.timestampMs);

  if (speedSamples.length < 2) return null;

  const points: DistancePoint[] = [
    { timestampMs: speedSamples[0]!.timestampMs, distanceM: 0 }
  ];
  let distanceM = 0;

  for (let index = 1; index < speedSamples.length; index += 1) {
    const previous = speedSamples[index - 1]!;
    const current = speedSamples[index]!;
    const durationSeconds = (current.timestampMs - previous.timestampMs) / 1000;
    if (durationSeconds <= 0 || durationSeconds > 60) continue;

    distanceM += ((previous.speedMps + current.speedMps) / 2) * durationSeconds;
    points.push({ timestampMs: current.timestampMs, distanceM });
  }

  return points.length >= 2
    ? { points: uniqueMonotonicPoints(points), source: 'healthkit_running_speed' }
    : null;
}

function crossingTime(points: DistancePoint[], targetDistanceM: number): number | null {
  for (let index = 1; index < points.length; index += 1) {
    const previous = points[index - 1]!;
    const current = points[index]!;

    if (current.distanceM < targetDistanceM) continue;
    if (current.distanceM <= previous.distanceM) return current.timestampMs;

    const fraction =
      (targetDistanceM - previous.distanceM) /
      (current.distanceM - previous.distanceM);
    return previous.timestampMs + fraction * (current.timestampMs - previous.timestampMs);
  }

  return null;
}

function round(value: number, digits = 2): number {
  const multiplier = 10 ** digits;
  return Math.round(value * multiplier) / multiplier;
}

export function generateKilometreSplits(
  timeline: DistanceTimeline,
  heartRateSamples: MetricRow[]
): Omit<SplitInsert, 'workout_id'>[] {
  const finalDistanceM = timeline.points.at(-1)?.distanceM ?? 0;
  const fullKilometres = Math.floor(finalDistanceM / 1000);
  if (fullKilometres <= 0) return [];

  const heartRates = heartRateSamples
    .filter((sample) => sample.metric_name === 'heart_rate' && sample.value > 0)
    .map((sample) => ({
      timestampMs: timestamp(sample.sampled_at),
      bpm: sample.value
    }))
    .filter(
      (sample): sample is { timestampMs: number; bpm: number } =>
        sample.timestampMs !== null
    )
    .sort((a, b) => a.timestampMs - b.timestampMs);

  const splits: Omit<SplitInsert, 'workout_id'>[] = [];
  let startMs = timeline.points[0]!.timestampMs;

  for (let splitNumber = 1; splitNumber <= fullKilometres; splitNumber += 1) {
    const endDistanceM = splitNumber * 1000;
    const endMs = crossingTime(timeline.points, endDistanceM);
    if (endMs === null || endMs <= startMs) break;

    const splitHeartRates = heartRates.filter(
      (sample) => sample.timestampMs >= startMs && sample.timestampMs <= endMs
    );
    const hrValues = splitHeartRates.map((sample) => sample.bpm);
    const durationSeconds = (endMs - startMs) / 1000;

    splits.push({
      split_kind: 'kilometre',
      split_number: splitNumber,
      started_at: new Date(startMs).toISOString(),
      ended_at: new Date(endMs).toISOString(),
      start_distance_m: (splitNumber - 1) * 1000,
      end_distance_m: endDistanceM,
      distance_m: 1000,
      duration_seconds: round(durationSeconds, 3),
      avg_pace_seconds_per_km: round(durationSeconds, 3),
      avg_heart_rate_bpm:
        hrValues.length > 0
          ? round(hrValues.reduce((sum, value) => sum + value, 0) / hrValues.length)
          : null,
      max_heart_rate_bpm: hrValues.length > 0 ? Math.max(...hrValues) : null,
      heart_rate_change_bpm:
        splitHeartRates.length >= 2
          ? round(splitHeartRates.at(-1)!.bpm - splitHeartRates[0]!.bpm)
          : null,
      source: timeline.source,
      algorithm_version: 'km-v1'
    });

    startMs = endMs;
  }

  return splits;
}

export class WorkoutSplitService {
  constructor(
    private readonly workoutService: WorkoutService,
    private readonly metricRepository: WorkoutMetricRepository,
    private readonly splitRepository: WorkoutSplitRepository
  ) {}

  list(workoutId: string) {
    return this.splitRepository.listByWorkout(workoutId);
  }

  async recalculateKilometreSplits(workoutId: string) {
    const workout = await this.workoutService.getById(workoutId);
    const metrics = await this.metricRepository.listByWorkoutMany(
      workoutId,
      ['heart_rate', 'running_speed', 'distance'],
      100000
    );

    const timeline = buildDistanceTimeline(workout, metrics);
    if (!timeline) {
      // Preserve any existing splits if this sync did not include enough pace/distance data.
      return this.splitRepository.listByWorkout(workoutId);
    }

    const splits = generateKilometreSplits(timeline, metrics);
    return this.splitRepository.replaceKilometreSplits(workoutId, splits);
  }
}
