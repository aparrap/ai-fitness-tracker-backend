import type { FitnessSupabaseClient } from '../../lib/supabase.js';
import type { Database, Json } from '../../types/database.types.js';
import { RepositoryError } from '../../shared/errors.js';

type SnapshotRow = Database['public']['Tables']['workout_analysis_snapshots']['Row'];

export class WorkoutAnalysisRepository {
  constructor(private readonly supabase: FitnessSupabaseClient) {}

  async getByWorkout(workoutId: string): Promise<SnapshotRow | null> {
    const { data, error } = await this.supabase
      .from('workout_analysis_snapshots')
      .select('*')
      .eq('workout_id', workoutId)
      .maybeSingle();

    if (error) {
      throw new RepositoryError('Failed to load workout analysis snapshot', error.message);
    }

    return data;
  }

  async listByWorkouts(workoutIds: string[]): Promise<SnapshotRow[]> {
    if (workoutIds.length === 0) return [];

    const rows: SnapshotRow[] = [];
    const batchSize = 100;

    for (let index = 0; index < workoutIds.length; index += batchSize) {
      const batch = workoutIds.slice(index, index + batchSize);
      const { data, error } = await this.supabase
        .from('workout_analysis_snapshots')
        .select('*')
        .in('workout_id', batch);

      if (error) {
        throw new RepositoryError('Failed to load workout analysis snapshots', error.message);
      }

      rows.push(...(data ?? []));
    }

    return rows;
  }

  async upsert(
    workoutId: string,
    analysis: unknown,
    algorithmVersion = 'analysis-v1'
  ): Promise<SnapshotRow> {
    const now = new Date().toISOString();
    const { data, error } = await this.supabase
      .from('workout_analysis_snapshots')
      .upsert(
        {
          workout_id: workoutId,
          analysis: analysis as Json,
          algorithm_version: algorithmVersion,
          computed_at: now,
          updated_at: now
        },
        { onConflict: 'workout_id' }
      )
      .select('*')
      .single();

    if (error) {
      throw new RepositoryError('Failed to save workout analysis snapshot', error.message);
    }

    return data;
  }
}
