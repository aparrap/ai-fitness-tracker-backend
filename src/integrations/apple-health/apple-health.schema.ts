import { z } from 'zod';

const timestamp = z.iso.datetime({ offset: true });

export const appleHealthHeartRateSampleSchema = z.object({
  sourceRecordId: z.string().min(1).max(200),
  sampledAt: timestamp,
  bpm: z.number().positive().max(260)
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
    heartRateSamples: z.array(appleHealthHeartRateSampleSchema).max(50000).default([])
  })
  .refine(
    (workout) => new Date(workout.endedAt).getTime() >= new Date(workout.startedAt).getTime(),
    {
      message: 'endedAt must be greater than or equal to startedAt',
      path: ['endedAt']
    }
  );

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
