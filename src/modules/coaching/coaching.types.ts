import { z } from 'zod';

export const WORKOUT_COACHING_PROMPT_VERSION = 'workout-coach-v1';
export const WORKOUT_COACHING_ANALYSIS_TYPE = 'workout_coaching';

export const workoutCoachingEvaluationSchema = z.object({
  headline: z.string().min(1).max(160),
  summary: z.string().min(1).max(1200),
  positives: z.array(z.string().min(1).max(300)).max(5),
  watchouts: z.array(z.string().min(1).max(300)).max(5),
  nextWorkoutFocus: z.array(z.string().min(1).max(300)).max(5),
  confidence: z.enum(['low', 'medium', 'high']),
  safetyNote: z.string().max(500).nullable()
});

export type WorkoutCoachingEvaluation = z.infer<
  typeof workoutCoachingEvaluationSchema
>;

export type CoachingSyncResult = {
  workoutId: string;
  sourceRecordId: string;
  status: 'completed' | 'disabled' | 'failed';
  summary?: string;
};

export type WorkoutCoachInput = {
  workout: unknown;
  analysis: unknown;
  trends: unknown | null;
};

export interface WorkoutCoachClient {
  readonly enabled: boolean;
  readonly model: string;
  evaluate(input: WorkoutCoachInput): Promise<WorkoutCoachingEvaluation>;
}
