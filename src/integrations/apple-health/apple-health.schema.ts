import { z } from 'zod';

const timestamp = z.iso.datetime({ offset: true });
const MAX_WORKOUT_SAMPLES = 100000;
const MAX_WORKOUT_DURATION_SECONDS = 7 * 24 * 60 * 60;
const MAX_WORKOUT_DISTANCE_M = 500000;
const MAX_WORKOUT_ACTIVE_ENERGY_KCAL = 50000;

export const appleHealthHeartRateSampleSchema = z.object({
  sourceRecordId: z.string().min(1).max(300),
  sampledAt: timestamp,
  bpm: z.number().positive().max(260)
});

export const appleHealthWorkoutSampleMetricSchema = z.enum([
  'heart_rate',
  'running_speed',
  'distance',
  'active_energy',
  'step_count',
  'running_power',
  'running_stride_length',
  'running_vertical_oscillation',
  'running_ground_contact_time'
]);

const aggregationSchema = z.enum(['instantaneous', 'interval_delta', 'cumulative']);
type Aggregation = z.infer<typeof aggregationSchema>;
type Metric = z.infer<typeof appleHealthWorkoutSampleMetricSchema>;

const canonicalUnitByMetric: Record<Metric, string> = {
  heart_rate: 'bpm',
  running_speed: 'm/s',
  distance: 'm',
  active_energy: 'kcal',
  step_count: 'count',
  running_power: 'W',
  running_stride_length: 'm',
  running_vertical_oscillation: 'm',
  running_ground_contact_time: 'ms'
};

const maxValueByMetric: Record<Metric, number> = {
  heart_rate: 260,
  running_speed: 20,
  distance: MAX_WORKOUT_DISTANCE_M,
  active_energy: MAX_WORKOUT_ACTIVE_ENERGY_KCAL,
  step_count: 1_000_000,
  running_power: 5_000,
  running_stride_length: 5,
  running_vertical_oscillation: 1,
  running_ground_contact_time: 5_000
};

const allowedAggregationsByMetric: Record<Metric, readonly Aggregation[]> = {
  heart_rate: ['instantaneous'],
  running_speed: ['instantaneous'],
  distance: ['interval_delta', 'cumulative'],
  active_energy: ['interval_delta'],
  step_count: ['interval_delta'],
  running_power: ['instantaneous'],
  running_stride_length: ['instantaneous'],
  running_vertical_oscillation: ['instantaneous'],
  running_ground_contact_time: ['instantaneous']
};

export const appleHealthWorkoutSampleSchema = z
  .object({
    sourceRecordId: z.string().min(1).max(300),
    metric: appleHealthWorkoutSampleMetricSchema,
    sampledAt: timestamp,
    sampleEndedAt: timestamp.optional(),
    value: z.number(),
    unit: z.string().min(1).max(40),
    associationKind: z
      .enum(['workout_associated', 'time_window'])
      .default('workout_associated'),
    aggregation: aggregationSchema,
    sourceName: z.string().max(200).optional(),
    sourceBundleIdentifier: z.string().max(300).optional()
  })
  .superRefine((sample, ctx) => {
    const sampledAtMs = new Date(sample.sampledAt).getTime();
    const sampleEndedAtMs = sample.sampleEndedAt
      ? new Date(sample.sampleEndedAt).getTime()
      : null;

    if (sampleEndedAtMs !== null && sampleEndedAtMs < sampledAtMs) {
      ctx.addIssue({
        code: 'custom',
        message: 'sampleEndedAt must be greater than or equal to sampledAt',
        path: ['sampleEndedAt']
      });
    }

    const expectedUnit = canonicalUnitByMetric[sample.metric];
    if (sample.unit !== expectedUnit) {
      ctx.addIssue({
        code: 'custom',
        message: `${sample.metric} unit must be ${expectedUnit}`,
        path: ['unit']
      });
    }

    const maxValue = maxValueByMetric[sample.metric];
    if (sample.value > maxValue) {
      ctx.addIssue({
        code: 'custom',
        message: `${sample.metric} cannot exceed ${maxValue} ${expectedUnit}`,
        path: ['value']
      });
    }

    if (sample.metric === 'heart_rate' && sample.value <= 0) {
      ctx.addIssue({
        code: 'custom',
        message: 'heart_rate value must be greater than 0 bpm',
        path: ['value']
      });
    } else if (sample.metric !== 'heart_rate' && sample.value < 0) {
      ctx.addIssue({
        code: 'custom',
        message: `${sample.metric} cannot be negative`,
        path: ['value']
      });
    }

    if (!allowedAggregationsByMetric[sample.metric].includes(sample.aggregation)) {
      ctx.addIssue({
        code: 'custom',
        message: `${sample.metric} does not support ${sample.aggregation} aggregation`,
        path: ['aggregation']
      });
    }

    if (
      sample.aggregation === 'interval_delta' &&
      (sampleEndedAtMs === null || sampleEndedAtMs <= sampledAtMs)
    ) {
      ctx.addIssue({
        code: 'custom',
        message: 'interval_delta samples require sampleEndedAt after sampledAt',
        path: ['sampleEndedAt']
      });
    }
  });

export const appleHealthWeightSchema = z.object({
  sourceRecordId: z.string().min(1).max(200),
  measuredAt: timestamp,
  measuredOn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  weightKg: z.number().positive().max(500),
  heightCm: z.number().positive().max(300).optional()
});

export const appleHealthWorkoutSchema = z
  .object({
    sourceRecordId: z.string().min(1).max(200),
    activityType: z.string().min(1).max(100),
    title: z.string().max(200).optional(),
    startedAt: timestamp,
    startedOn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    endedAt: timestamp,
    durationSeconds: z.number().int().nonnegative().max(MAX_WORKOUT_DURATION_SECONDS).optional(),
    distanceM: z.number().nonnegative().max(MAX_WORKOUT_DISTANCE_M).optional(),
    activeEnergyKcal: z.number().nonnegative().max(MAX_WORKOUT_ACTIVE_ENERGY_KCAL).optional(),
    elevationGainM: z.number().min(-20000).max(20000).optional(),
    avgHeartRateBpm: z.number().positive().max(260).optional(),
    maxHeartRateBpm: z.number().positive().max(260).optional(),
    sourceName: z.string().max(200).optional(),
    sourceBundleIdentifier: z.string().max(300).optional(),
    samples: z.array(appleHealthWorkoutSampleSchema).max(MAX_WORKOUT_SAMPLES).default([]),
    heartRateSamples: z.array(appleHealthHeartRateSampleSchema).max(50000).default([])
  })
  .superRefine((workout, ctx) => {
    const startedAtMs = new Date(workout.startedAt).getTime();
    const endedAtMs = new Date(workout.endedAt).getTime();
    const timestampDurationSeconds = (endedAtMs - startedAtMs) / 1000;

    if (endedAtMs < startedAtMs) {
      ctx.addIssue({ code: 'custom', message: 'endedAt must be greater than or equal to startedAt', path: ['endedAt'] });
    } else if (timestampDurationSeconds > MAX_WORKOUT_DURATION_SECONDS) {
      ctx.addIssue({ code: 'custom', message: `Workout timestamps may span at most ${MAX_WORKOUT_DURATION_SECONDS} seconds`, path: ['endedAt'] });
    }

    if (workout.samples.length + workout.heartRateSamples.length > MAX_WORKOUT_SAMPLES) {
      ctx.addIssue({ code: 'custom', message: `A workout may contain at most ${MAX_WORKOUT_SAMPLES} total samples`, path: ['samples'] });
    }

    workout.samples.forEach((sample, index) => {
      const sampleStartMs = new Date(sample.sampledAt).getTime();
      const sampleEndMs = sample.sampleEndedAt ? new Date(sample.sampleEndedAt).getTime() : sampleStartMs;
      if (sampleEndMs < startedAtMs || sampleStartMs > endedAtMs) {
        ctx.addIssue({ code: 'custom', message: 'Workout samples must overlap the workout interval', path: ['samples', index, 'sampledAt'] });
      }
    });

    workout.heartRateSamples.forEach((sample, index) => {
      const sampledAtMs = new Date(sample.sampledAt).getTime();
      if (sampledAtMs < startedAtMs || sampledAtMs > endedAtMs) {
        ctx.addIssue({ code: 'custom', message: 'Legacy heart-rate samples must fall within the workout interval', path: ['heartRateSamples', index, 'sampledAt'] });
      }
    });

    const distanceAggregationModes = new Set(
      workout.samples.filter((sample) => sample.metric === 'distance').map((sample) => sample.aggregation)
    );
    if (distanceAggregationModes.size > 1) {
      ctx.addIssue({ code: 'custom', message: 'distance samples must use one aggregation mode per workout', path: ['samples'] });
    }
  });

export const appleHealthImportSchema = z.object({
  syncId: z.string().min(8).max(200),
  exportedAt: timestamp,
  device: z
    .object({
      name: z.string().max(200).optional(),
      model: z.string().max(200).optional(),
      systemVersion: z.string().max(100).optional(),
      appVersion: z.string().max(100).optional()
    })
    .optional(),
  weights: z.array(appleHealthWeightSchema).max(1000).default([]),
  workouts: z.array(appleHealthWorkoutSchema).max(500).default([]),
  deletedWorkoutSourceRecordIds: z.array(z.string().min(1).max(300)).max(500).default([])
});

export type AppleHealthImportInput = z.infer<typeof appleHealthImportSchema>;
export type AppleHealthWeightPayload = z.infer<typeof appleHealthWeightSchema>;
export type AppleHealthWorkoutPayload = z.infer<typeof appleHealthWorkoutSchema>;
export type AppleHealthHeartRateSamplePayload = z.infer<typeof appleHealthHeartRateSampleSchema>;
export type AppleHealthWorkoutSamplePayload = z.infer<typeof appleHealthWorkoutSampleSchema>;
export type AppleHealthWorkoutSampleMetric = z.infer<typeof appleHealthWorkoutSampleMetricSchema>;
