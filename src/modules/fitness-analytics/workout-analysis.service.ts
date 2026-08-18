import type { Database, Json } from '../../types/database.types.js';
import type { WorkoutService } from '../workouts/workout.service.js';
import type { WorkoutMetricRepository } from '../workout-metrics/workout-metric.repository.js';
import type { WorkoutSplitService } from '../workout-splits/workout-split.service.js';
import { analyseHrPace } from './hr-pace.service.js';
import type { AnalysisSample } from './fitness-analytics.types.js';

type MetricRow = Database['public']['Tables']['workout_metric_samples']['Row'];
type WorkoutRow = Database['public']['Tables']['workouts']['Row'];

function aggregationOf(row: MetricRow): string | undefined {
  const raw = row.raw_payload;
  if (!raw || Array.isArray(raw) || typeof raw !== 'object') return undefined;
  const value = (raw as { aggregation?: Json }).aggregation;
  return typeof value === 'string' ? value : undefined;
}

function toAnalysisSample(row: MetricRow): AnalysisSample {
  const aggregation = aggregationOf(row);
  return {
    metricName: row.metric_name,
    sampledAt: row.sampled_at,
    sampleEndedAt: row.sample_ended_at,
    value: row.value,
    ...(aggregation !== undefined ? { aggregation } : {})
  };
}

export class WorkoutAnalysisService {
  constructor(
    private readonly workoutService: WorkoutService,
    private readonly metricRepository: WorkoutMetricRepository,
    private readonly splitService: WorkoutSplitService
  ) {}

  async analyse(workoutId: string) {
    const workout = await this.workoutService.getById(workoutId);
    return this.analyseWorkout(workout);
  }

  async analyseWorkout(workout: WorkoutRow) {
    const metrics = await this.metricRepository.listByWorkoutMany(
      workout.id,
      ['heart_rate', 'running_speed', 'distance'],
      100000
    );
    const physiology = analyseHrPace(metrics.map(toAnalysisSample));

    // Splits are recalculated during import when new distance/speed data arrives.
    // Read-only analytics must not rewrite persisted data on every GET/trend request.
    const splits = await this.splitService.list(workout.id);
    const kilometreSplits = splits.filter((split) => split.split_kind === 'kilometre');
    const fastestKilometre = kilometreSplits
      .filter((split) => split.avg_pace_seconds_per_km !== null)
      .sort(
        (a, b) =>
          (a.avg_pace_seconds_per_km ?? Number.POSITIVE_INFINITY) -
          (b.avg_pace_seconds_per_km ?? Number.POSITIVE_INFINITY)
      )[0];

    return {
      workoutId: workout.id,
      activityType: workout.activity_type,
      startedAt: workout.started_at,
      distanceM: workout.distance_m,
      durationSeconds: workout.duration_seconds,
      averagePaceSecondsPerKm: workout.avg_pace_seconds_per_km,
      averageHeartRateBpm: workout.avg_heart_rate_bpm,
      maxHeartRateBpm: workout.max_heart_rate_bpm,
      ...physiology,
      fastestKilometre: fastestKilometre
        ? {
            splitNumber: fastestKilometre.split_number,
            durationSeconds: fastestKilometre.duration_seconds,
            paceSecondsPerKm: fastestKilometre.avg_pace_seconds_per_km,
            avgHeartRateBpm: fastestKilometre.avg_heart_rate_bpm,
            maxHeartRateBpm: fastestKilometre.max_heart_rate_bpm
          }
        : null
    };
  }
}
