import { createHash } from 'node:crypto';
import type { Database } from '../../types/database.types.js';
import type { RunningTrendService } from '../fitness-analytics/running-trend.service.js';
import type { CoachingRepository } from './coaching.repository.js';
import type {
  CoachingSyncResult,
  WorkoutCoachClient
} from './coaching.types.js';

type WorkoutRow = Database['public']['Tables']['workouts']['Row'];

function inputHash(value: unknown): string {
  return createHash('sha256').update(JSON.stringify(value)).digest('hex');
}

export class WorkoutCoachingService {
  constructor(
    private readonly client: WorkoutCoachClient,
    private readonly repository: CoachingRepository,
    private readonly runningTrendService: RunningTrendService
  ) {}

  async evaluate(params: {
    workout: WorkoutRow;
    sourceRecordId: string;
    analysis: unknown;
  }): Promise<CoachingSyncResult> {
    if (!this.client.enabled) {
      return {
        workoutId: params.workout.id,
        sourceRecordId: params.sourceRecordId,
        status: 'disabled'
      };
    }

    const trends =
      params.workout.activity_type === 'running'
        ? await this.runningTrendService.getRunningEfficiencyTrends()
        : null;

    const inputSnapshot = {
      workout: {
        id: params.workout.id,
        activityType: params.workout.activity_type,
        startedOn: params.workout.started_on,
        startedAt: params.workout.started_at,
        durationSeconds: params.workout.duration_seconds,
        distanceM: params.workout.distance_m,
        activeEnergyKcal: params.workout.active_energy_kcal,
        averageHeartRateBpm: params.workout.avg_heart_rate_bpm,
        maxHeartRateBpm: params.workout.max_heart_rate_bpm,
        averagePaceSecondsPerKm: params.workout.avg_pace_seconds_per_km
      },
      analysis: params.analysis,
      trends
    };
    const hash = inputHash(inputSnapshot);
    const existing = await this.repository.getCurrent(params.workout.id);

    if (
      existing?.input_hash === hash &&
      existing.model === this.client.model &&
      existing.summary
    ) {
      return {
        workoutId: params.workout.id,
        sourceRecordId: params.sourceRecordId,
        status: 'unchanged',
        summary: existing.summary
      };
    }

    const evaluation = await this.client.evaluate(inputSnapshot);
    await this.repository.upsert({
      workoutId: params.workout.id,
      model: this.client.model,
      inputHash: hash,
      evaluation,
      inputSnapshot
    });

    return {
      workoutId: params.workout.id,
      sourceRecordId: params.sourceRecordId,
      status: 'completed',
      summary: evaluation.summary
    };
  }

  getLatest(workoutId: string) {
    return this.repository.getLatest(workoutId);
  }
}
