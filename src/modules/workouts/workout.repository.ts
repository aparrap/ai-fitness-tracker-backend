import type { FitnessSupabaseClient } from '../../lib/supabase.js';
import type { Database } from '../../types/database.types.js';
import { NotFoundError, RepositoryError } from '../../shared/errors.js';

type WorkoutRow = Database['public']['Tables']['workouts']['Row'];
type WorkoutInsert = Database['public']['Tables']['workouts']['Insert'];

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
