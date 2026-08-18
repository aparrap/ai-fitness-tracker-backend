import { z } from 'zod';

const timestamp = z.iso.datetime({ offset: true });
const MAX_WORKOUT_SAMPLES = 100000;

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

const canonicalUnitByMetric = {
  heart_rate: 'bpm',
  running_speed: 'm/s',
  distance: 'm',
  active_energy: 'kcal',
  step_count: 'count',
  running_power: 'W',
  running_stride_length: 'm',
  running_vertical_oscillation: 'm',
  running_ground_contact_time: 'ms'
} as const;

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
    aggregation: z
      .enum(['instantaneous', 'interval_delta', 'cumulative'])
      .optional(),
    sourceName: z.string().max(200).optional(),
    sourceBundleIdentifier: z.string().max(300).optional()
  })
  .superRefine((sample, ctx) => {
    if (
      sample.sampleEndedAt &&
      new Date(sample.sampleEndedAt).getTime() < new Date(sample.sampledAt).getTime()
    ) {
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

    if (sample.metric === 'heart_rate' && (sample.value <= 0 || sample.value > 260)) {
      ctx.addIssue({
        code: 'custom',
        message: 'heart_rate value must be between 0 and 260 bpm',
        path: ['value']
      });
    }

    if (
      ['running_speed', 'distance', 'active_energy', 'step_count'].includes(
        sample.metric
      ) &&
      sample.value < 0
    ) {
      ctx.addIssue({
        code: 'custom',
        message: `${sample.metric} cannot be negative`,
        path: ['value']
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
    durationSeconds: z.number().int().nonnegative().optional(),
    distanceM: z.number().nonnegative().optional(),
    activeEnergyKcal: z.number().nonnegative().optional(),
    elevationGainM: z.number().optional(),
    avgHeartRateBpm: z.number().positive().max(260).optional(),
    maxHeartRateBpm: z.number().positive().max(260).optional(),
    sourceName: z.string().max(200).optional(),
    sourceBundleIdentifier: z.string().max(300).optional(),
    samples: z.array(appleHealthWorkoutSampleSchema).max(MAX_WORKOUT_SAMPLES).default([]),
    // Backward compatibility with the Phase 2 iOS bridge.
    heartRateSamples: z.array(appleHealthHeartRateSampleSchema).max(50000).default([])
  })
  .superRefine((workout, ctx) => {
    if (new Date(workout.endedAt).getTime() < new Date(workout.startedAt).getTime()) {
      ctx.addIssue({
        code: 'custom',
        message: 'endedAt must be greater than or equal to startedAt',
        path: ['endedAt']
      });
    }

    if (workout.samples.length + workout.heartRateSamples.length > MAX_WORKOUT_SAMPLES) {
      ctx.addIssue({
        code: 'custom',
        message: `A workout may contain at most ${MAX_WORKOUT_SAMPLES} total samples`,
        path: ['samples']
      });
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
  workouts: z.array(appleHealthWorkoutSchema).max(500).default([])
});

export type AppleHealthImportInput = z.infer<typeof appleHealthImportSchema>;
export type AppleHealthWeightPayload = z.infer<typeof appleHealthWeightSchema>;
export type AppleHealthWorkoutPayload = z.infer<typeof appleHealthWorkoutSchema>;
export type AppleHealthHeartRateSamplePayload = z.infer<
  typeof appleHealthHeartRateSampleSchema
>;
export type AppleHealthWorkoutSamplePayload = z.infer<
  typeof appleHealthWorkoutSampleSchema
>;
export type AppleHealthWorkoutSampleMetric = z.infer<
  typeof appleHealthWorkoutSampleMetricSchema
>;
