import type { FitnessSupabaseClient } from '../../lib/supabase.js';
import type { Database } from '../../types/database.types.js';
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

  async replaceKilometreSplits(
    workoutId: string,
    splits: Omit<SplitInsert, 'workout_id'>[]
  ): Promise<SplitRow[]> {
    if (splits.length === 0) {
      const { error } = await this.supabase
        .from('workout_splits')
        .delete()
        .eq('workout_id', workoutId)
        .eq('split_kind', 'kilometre');

      if (error) {
        throw new RepositoryError('Failed to clear workout splits', error.message);
      }

      return [];
    }

    const rows: SplitInsert[] = splits.map((split) => ({
      ...split,
      workout_id: workoutId
    }));

    const { error: upsertError } = await this.supabase
      .from('workout_splits')
      .upsert(rows, {
        onConflict: 'workout_id,split_kind,split_number'
      });

    if (upsertError) {
      throw new RepositoryError('Failed to save workout splits', upsertError.message);
    }

    const maxSplit = Math.max(...splits.map((split) => split.split_number));
    const { error: deleteError } = await this.supabase
      .from('workout_splits')
      .delete()
      .eq('workout_id', workoutId)
      .eq('split_kind', 'kilometre')
      .gt('split_number', maxSplit);

    if (deleteError) {
      throw new RepositoryError('Failed to remove stale workout splits', deleteError.message);
    }

    return this.listByWorkout(workoutId);
  }
}
