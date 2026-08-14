export type FitnessAnalysisInput = {
  latestWeightKg: number | null;
  weightHistory: Array<{
    date: string;
    weightKg: number;
  }>;
  runningHistory: Array<{
    date: string;
    distanceKm: number | null;
    durationSeconds: number | null;
    paceSecondsPerKm: number | null;
    averageHeartRateBpm: number | null;
  }>;
};

export type FitnessAnalysis = {
  summary: string;
  observations: string[];
  nextActions: string[];
};

/**
 * Future OpenAI implementation plugs into this port.
 * Keeping the AI layer behind an interface means model/provider changes never
 * affect the workout or body-measurement persistence code.
 */
export interface FitnessAnalysisProvider {
  analyse(input: FitnessAnalysisInput): Promise<FitnessAnalysis>;
}
