import type { FitnessSupabaseClient } from '../../lib/supabase.js';
import type { Database, Json } from '../../types/database.types.js';
import { RepositoryError } from '../../shared/errors.js';
import {
  WORKOUT_COACHING_ANALYSIS_TYPE,
  WORKOUT_COACHING_PROMPT_VERSION,
  type WorkoutCoachingEvaluation
} from './coaching.types.js';

type AnalysisRow = Database['public']['Tables']['ai_analyses']['Row'];

export class CoachingRepository {
  constructor(
    private readonly supabase: FitnessSupabaseClient,
    private readonly profileId: string
  ) {}

  async getLatest(workoutId: string): Promise<AnalysisRow | null> {
    const { data, error } = await this.supabase
      .from('ai_analyses')
      .select('*')
      .eq('profile_id', this.profileId)
      .eq('workout_id', workoutId)
      .eq('analysis_type', WORKOUT_COACHING_ANALYSIS_TYPE)
      .order('updated_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) {
      throw new RepositoryError('Failed to load workout coaching evaluation', error.message);
    }

    return data;
  }

  async upsert(params: {
    workoutId: string;
    model: string;
    evaluation: WorkoutCoachingEvaluation;
    inputSnapshot: unknown;
  }): Promise<AnalysisRow> {
    const now = new Date().toISOString();
    const { data, error } = await this.supabase
      .from('ai_analyses')
      .upsert(
        {
          profile_id: this.profileId,
          workout_id: params.workoutId,
          analysis_type: WORKOUT_COACHING_ANALYSIS_TYPE,
          model: params.model,
          prompt_version: WORKOUT_COACHING_PROMPT_VERSION,
          summary: params.evaluation.summary,
          result: params.evaluation as unknown as Json,
          input_snapshot: params.inputSnapshot as Json,
          updated_at: now
        },
        {
          onConflict: 'profile_id,workout_id,analysis_type,prompt_version'
        }
      )
      .select('*')
      .single();

    if (error) {
      throw new RepositoryError('Failed to save workout coaching evaluation', error.message);
    }

    return data;
  }
}
