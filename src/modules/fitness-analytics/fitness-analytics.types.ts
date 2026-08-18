export type AnalysisSample = {
  metricName: string;
  sampledAt: string | null;
  sampleEndedAt?: string | null;
  value: number;
  aggregation?: string;
};

export type AlignedRunningPoint = {
  sampledAt: string;
  heartRateBpm: number;
  speedMps: number;
  paceSecondsPerKm: number;
  efficiencyMetersPerHeartbeat: number;
};

export type HrPaceBand = {
  targetBpm: number;
  minBpm: number;
  maxBpm: number;
  sampleCount: number;
  durationSeconds: number;
  avgHeartRateBpm: number | null;
  avgSpeedMps: number | null;
  paceSecondsPerKm: number | null;
};

export type HeartRateBySpeedBucket = {
  speedMps: number;
  paceSecondsPerKm: number;
  avgHeartRateBpm: number;
  sampleCount: number;
  durationSeconds: number;
};

export type RunningPhysiologyAnalysis = {
  alignedSampleCount: number;
  analysedDurationSeconds: number;
  speedSource: 'running_speed' | 'distance' | null;
  hrPaceBands: HrPaceBand[];
  heartRateBySpeed: HeartRateBySpeedBucket[];
  aerobicEfficiencyMetersPerHeartbeat: number | null;
  heartRateDrift: {
    firstHalfAvgHeartRateBpm: number | null;
    secondHalfAvgHeartRateBpm: number | null;
    changeBpm: number | null;
    changePercent: number | null;
    firstHalfEfficiency: number | null;
    secondHalfEfficiency: number | null;
    aerobicDecouplingPercent: number | null;
  };
  consistency: {
    paceCoefficientOfVariation: number | null;
    heartRateCoefficientOfVariation: number | null;
  };
};
