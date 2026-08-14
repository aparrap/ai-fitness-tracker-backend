import type { Database } from '../../types/database.types.js';
import type { CreateWorkoutInput } from './workout.schema.js';
import { WorkoutRepository } from './workout.repository.js';

type WorkoutRow = Database['public']['Tables']['workouts']['Row'];

export function derivePaceSecondsPerKm(
  durationSeconds?: number,
  distanceM?: number
): number | null {
  if (!durationSeconds || !distanceM || distanceM <= 0) return null;
  return Math.round(durationSeconds / (distanceM / 1000));
}

export class WorkoutService {
  constructor(
    private readonly repository: WorkoutRepository,
    private readonly profileId: string
  ) {}

  list(limit: number, activityType?: string): Promise<WorkoutRow[]> {
    return this.repository.list(limit, activityType);
  }

  getById(id: string): Promise<WorkoutRow> {
    return this.repository.getById(id);
  }

  async create(input: CreateWorkoutInput): Promise<WorkoutRow> {
    const derivedPace =
      input.avgPaceSecondsPerKm ??
      derivePaceSecondsPerKm(input.durationSeconds, input.distanceM);

    const sourceRecordId =
      input.sourceRecordId ??
      [
        'api-workout',
        input.sourceProvider,
        input.activityType,
        input.startedOn,
        input.durationSeconds ?? 'na',
        input.distanceM ?? 'na'
      ].join('-');

    return this.repository.upsert({
      profile_id: this.profileId,
      activity_type: input.activityType,
      started_on: input.startedOn,
      started_at: input.startedAt ?? null,
      date_precision: input.startedAt ? 'exact_timestamp' : 'explicit_date',
      title: input.title ?? null,
      duration_seconds: input.durationSeconds ?? null,
      moving_duration_seconds: input.movingDurationSeconds ?? null,
      distance_m: input.distanceM ?? null,
      active_energy_kcal: input.activeEnergyKcal ?? null,
      avg_heart_rate_bpm: input.avgHeartRateBpm ?? null,
      max_heart_rate_bpm: input.maxHeartRateBpm ?? null,
      avg_pace_seconds_per_km: derivedPace,
      elevation_gain_m: input.elevationGainM ?? null,
      source_provider: input.sourceProvider,
      source_record_id: sourceRecordId,
      ingested_via: 'backend_api',
      notes: input.notes ?? null
    });
  }
}
