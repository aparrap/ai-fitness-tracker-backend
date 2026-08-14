import type { Database } from '../../types/database.types.js';
import type { WeightRepository } from '../weights/weight.repository.js';
import type { WorkoutRepository } from '../workouts/workout.repository.js';

type WeightRow = Database['public']['Tables']['body_measurements']['Row'];
type WorkoutRow = Database['public']['Tables']['workouts']['Row'];

export type FitnessSummary = {
  latestWeightKg: number | null;
  latestWeightDate: string | null;
  weightChangeFromPreviousKg: number | null;
  running: {
    workoutCount: number;
    totalDistanceKm: number;
    totalDurationMinutes: number;
    averagePaceSecondsPerKm: number | null;
    averageHeartRateBpm: number | null;
  };
};

function validNumber(value: number | null): value is number {
  return value !== null && Number.isFinite(value);
}

export function buildFitnessSummary(
  weights: WeightRow[],
  runs: WorkoutRow[]
): FitnessSummary {
  const latest = weights[0];
  const previous = weights[1];

  const distances = runs.map((run) => run.distance_m).filter(validNumber);
  const durations = runs.map((run) => run.duration_seconds).filter(validNumber);
  const paces = runs.map((run) => run.avg_pace_seconds_per_km).filter(validNumber);
  const heartRates = runs.map((run) => run.avg_heart_rate_bpm).filter(validNumber);

  return {
    latestWeightKg: latest?.weight_kg ?? null,
    latestWeightDate: latest?.measured_on ?? null,
    weightChangeFromPreviousKg:
      latest?.weight_kg != null && previous?.weight_kg != null
        ? Number((latest.weight_kg - previous.weight_kg).toFixed(2))
        : null,
    running: {
      workoutCount: runs.length,
      totalDistanceKm: Number(
        (distances.reduce((total, value) => total + value, 0) / 1000).toFixed(2)
      ),
      totalDurationMinutes: Number(
        (durations.reduce((total, value) => total + value, 0) / 60).toFixed(1)
      ),
      averagePaceSecondsPerKm:
        paces.length > 0
          ? Math.round(paces.reduce((total, value) => total + value, 0) / paces.length)
          : null,
      averageHeartRateBpm:
        heartRates.length > 0
          ? Math.round(
              heartRates.reduce((total, value) => total + value, 0) / heartRates.length
            )
          : null
    }
  };
}

export class StatsService {
  constructor(
    private readonly weights: WeightRepository,
    private readonly workouts: WorkoutRepository
  ) {}

  async summary(): Promise<FitnessSummary> {
    const [weights, runs] = await Promise.all([
      this.weights.list(2),
      this.workouts.list(500, 'running')
    ]);

    return buildFitnessSummary(weights, runs);
  }
}
