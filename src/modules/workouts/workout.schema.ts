import { z } from 'zod';

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Expected YYYY-MM-DD');

export const createWorkoutSchema = z.object({
  activityType: z.string().min(1).default('running'),
  startedOn: isoDate,
  startedAt: z.iso.datetime({ offset: true }).optional(),
  title: z.string().max(200).optional(),
  durationSeconds: z.number().int().nonnegative().optional(),
  movingDurationSeconds: z.number().int().nonnegative().optional(),
  distanceM: z.number().nonnegative().optional(),
  activeEnergyKcal: z.number().nonnegative().optional(),
  avgHeartRateBpm: z.number().positive().max(260).optional(),
  maxHeartRateBpm: z.number().positive().max(260).optional(),
  avgPaceSecondsPerKm: z.number().int().positive().optional(),
  elevationGainM: z.number().optional(),
  sourceProvider: z.string().min(1).default('manual'),
  sourceRecordId: z.string().min(1).optional(),
  notes: z.string().max(2000).optional()
});

export type CreateWorkoutInput = z.infer<typeof createWorkoutSchema>;

export const workoutListQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(500).default(100),
  activityType: z.string().min(1).optional()
});
