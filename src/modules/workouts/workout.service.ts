import type { Database, Json } from '../../types/database.types.js';
import type { CreateWorkoutInput } from './workout.schema.js';
import { WorkoutRepository } from './workout.repository.js';

type WorkoutRow = Database['public']['Tables']['workouts']['Row'];

export type WorkoutPersistenceOptions = {
  ingestedVia?: string;
  rawPayload?: Json;
};

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


  findLikelyDuplicate(input: CreateWorkoutInput): Promise<WorkoutRow | null> {
    return this.repository.findLikelyDuplicate({
      activityType: input.activityType,
      startedOn: input.startedOn,
      ...(input.durationSeconds !== undefined
        ? { durationSeconds: input.durationSeconds }
        : {}),
      ...(input.distanceM !== undefined ? { distanceM: input.distanceM } : {})
    });
  }

  async enrichExisting(
    id: string,
    input: CreateWorkoutInput
  ): Promise<WorkoutRow> {
    const derivedPace =
      input.avgPaceSecondsPerKm ??
      derivePaceSecondsPerKm(input.durationSeconds, input.distanceM);

    return this.repository.updateById(id, {
      ...(input.startedAt !== undefined ? { started_at: input.startedAt } : {}),
      ...(input.title !== undefined ? { title: input.title } : {}),
      ...(input.durationSeconds !== undefined
        ? { duration_seconds: input.durationSeconds }
        : {}),
      ...(input.movingDurationSeconds !== undefined
        ? { moving_duration_seconds: input.movingDurationSeconds }
        : {}),
      ...(input.distanceM !== undefined ? { distance_m: input.distanceM } : {}),
      ...(input.activeEnergyKcal !== undefined
        ? { active_energy_kcal: input.activeEnergyKcal }
        : {}),
      ...(input.avgHeartRateBpm !== undefined
        ? { avg_heart_rate_bpm: input.avgHeartRateBpm }
        : {}),
      ...(input.maxHeartRateBpm !== undefined
        ? { max_heart_rate_bpm: input.maxHeartRateBpm }
        : {}),
      ...(derivedPace !== null ? { avg_pace_seconds_per_km: derivedPace } : {}),
      ...(input.elevationGainM !== undefined
        ? { elevation_gain_m: input.elevationGainM }
        : {}),
      updated_at: new Date().toISOString()
    });
  }

  async create(
    input: CreateWorkoutInput,
    options: WorkoutPersistenceOptions = {}
  ): Promise<WorkoutRow> {
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
      ingested_via: options.ingestedVia ?? 'backend_api',
      notes: input.notes ?? null,
      raw_payload: options.rawPayload ?? null
    });
  }
}
