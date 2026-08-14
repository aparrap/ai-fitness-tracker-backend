import type { FitnessSupabaseClient } from '../../lib/supabase.js';
import type { Database } from '../../types/database.types.js';
import { NotFoundError, RepositoryError } from '../../shared/errors.js';

type WorkoutRow = Database['public']['Tables']['workouts']['Row'];
type WorkoutInsert = Database['public']['Tables']['workouts']['Insert'];
type WorkoutUpdate = Database['public']['Tables']['workouts']['Update'];

export class WorkoutRepository {
  constructor(
    private readonly supabase: FitnessSupabaseClient,
    private readonly profileId: string
  ) {}

  async list(limit = 100, activityType?: string): Promise<WorkoutRow[]> {
    let query = this.supabase
      .from('workouts')
      .select('*')
      .eq('profile_id', this.profileId)
      .order('started_on', { ascending: false })
      .limit(limit);

    if (activityType) {
      query = query.eq('activity_type', activityType);
    }

    const { data, error } = await query;

    if (error) {
      throw new RepositoryError('Failed to load workouts', error.message);
    }

    return data ?? [];
  }

  async getById(id: string): Promise<WorkoutRow> {
    const { data, error } = await this.supabase
      .from('workouts')
      .select('*')
      .eq('profile_id', this.profileId)
      .eq('id', id)
      .maybeSingle();

    if (error) {
      throw new RepositoryError('Failed to load workout', error.message);
    }

    if (!data) {
      throw new NotFoundError(`Workout ${id} was not found`);
    }

    return data;
  }


  async findLikelyDuplicate(params: {
    activityType: string;
    startedOn: string;
    durationSeconds?: number;
    distanceM?: number;
  }): Promise<WorkoutRow | null> {
    const { data, error } = await this.supabase
      .from('workouts')
      .select('*')
      .eq('profile_id', this.profileId)
      .eq('activity_type', params.activityType)
      .eq('started_on', params.startedOn);

    if (error) {
      throw new RepositoryError('Failed to search for duplicate workout', error.message);
    }

    const candidates = data ?? [];

    const scored = candidates
      .map((candidate) => {
        const durationDifference =
          params.durationSeconds != null && candidate.duration_seconds != null
            ? Math.abs(candidate.duration_seconds - params.durationSeconds)
            : 0;

        const distanceDifference =
          params.distanceM != null && candidate.distance_m != null
            ? Math.abs(candidate.distance_m - params.distanceM)
            : 0;

        const durationCompatible =
          params.durationSeconds == null ||
          candidate.duration_seconds == null ||
          durationDifference <= 180;

        const distanceCompatible =
          params.distanceM == null ||
          candidate.distance_m == null ||
          distanceDifference <= 350;

        return {
          candidate,
          compatible: durationCompatible && distanceCompatible,
          score: durationDifference + distanceDifference / 10
        };
      })
      .filter((item) => item.compatible)
      .sort((a, b) => a.score - b.score);

    return scored[0]?.candidate ?? null;
  }

  async updateById(id: string, input: WorkoutUpdate): Promise<WorkoutRow> {
    const { data, error } = await this.supabase
      .from('workouts')
      .update(input)
      .eq('profile_id', this.profileId)
      .eq('id', id)
      .select('*')
      .single();

    if (error) {
      throw new RepositoryError('Failed to update workout', error.message);
    }

    return data;
  }

  async upsert(input: WorkoutInsert): Promise<WorkoutRow> {
    const { data, error } = await this.supabase
      .from('workouts')
      .upsert(input, {
        onConflict: 'profile_id,source_provider,source_record_id'
      })
      .select('*')
      .single();

    if (error) {
      throw new RepositoryError('Failed to save workout', error.message);
    }

    return data;
  }
}
