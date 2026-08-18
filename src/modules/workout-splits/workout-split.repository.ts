import type { FitnessSupabaseClient } from '../../lib/supabase.js';
import type { Database, Json } from '../../types/database.types.js';
import { RepositoryError } from '../../shared/errors.js';

type SplitRow = Database['public']['Tables']['workout_splits']['Row'];
type SplitInsert = Database['public']['Tables']['workout_splits']['Insert'];

export class WorkoutSplitRepository {
  constructor(private readonly supabase: FitnessSupabaseClient) {}

  async listByWorkout(workoutId: string): Promise<SplitRow[]> {
    const { data, error } = await this.supabase
      .from('workout_splits')
      .select('*')
      .eq('workout_id', workoutId)
      .order('split_number', { ascending: true });

    if (error) {
      throw new RepositoryError('Failed to load workout splits', error.message);
    }

    return data ?? [];
  }

  async listByWorkouts(workoutIds: string[]): Promise<SplitRow[]> {
    if (workoutIds.length === 0) return [];

    const rows: SplitRow[] = [];
    const batchSize = 100;

    for (let index = 0; index < workoutIds.length; index += batchSize) {
      const batch = workoutIds.slice(index, index + batchSize);
      const { data, error } = await this.supabase
        .from('workout_splits')
        .select('*')
        .in('workout_id', batch)
        .eq('split_kind', 'kilometre')
        .order('workout_id', { ascending: true })
        .order('split_number', { ascending: true });

      if (error) {
        throw new RepositoryError('Failed to load workout splits', error.message);
      }

      rows.push(...(data ?? []));
    }

    return rows;
  }

  async replaceKilometreSplits(
    workoutId: string,
    splits: Omit<SplitInsert, 'workout_id'>[]
  ): Promise<SplitRow[]> {
    const payload = splits.map(({ created_at: _createdAt, updated_at: _updatedAt, ...split }) =>
      split
    );

    const { data, error } = await this.supabase.rpc(
      'replace_workout_kilometre_splits',
      {
        p_workout_id: workoutId,
        p_splits: payload as unknown as Json
      }
    );

    if (error) {
      throw new RepositoryError('Failed to replace workout splits', error.message);
    }

    return data ?? [];
  }
}
