import type { FitnessSupabaseClient } from '../../lib/supabase.js';
import type { Json } from '../../types/database.types.js';
import { RepositoryError } from '../../shared/errors.js';

export class WorkoutSourceRepository {
  constructor(
    private readonly supabase: FitnessSupabaseClient,
    private readonly profileId: string
  ) {}

  async findWorkoutId(
    sourceProvider: string,
    sourceRecordId: string
  ): Promise<string | null> {
    const { data, error } = await this.supabase
      .from('workout_source_links')
      .select('workout_id')
      .eq('profile_id', this.profileId)
      .eq('source_provider', sourceProvider)
      .eq('source_record_id', sourceRecordId)
      .maybeSingle();

    if (error) {
      throw new RepositoryError('Failed to find workout source link', error.message);
    }

    return data?.workout_id ?? null;
  }

  async link(params: {
    workoutId: string;
    sourceProvider: string;
    sourceRecordId: string;
    rawPayload?: Json;
  }): Promise<void> {
    const { error } = await this.supabase
      .from('workout_source_links')
      .upsert(
        {
          profile_id: this.profileId,
          workout_id: params.workoutId,
          source_provider: params.sourceProvider,
          source_record_id: params.sourceRecordId,
          raw_payload: params.rawPayload ?? null
        },
        {
          onConflict: 'profile_id,source_provider,source_record_id'
        }
      );

    if (error) {
      throw new RepositoryError('Failed to link workout source', error.message);
    }
  }
}
