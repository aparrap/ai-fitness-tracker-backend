import { z } from 'zod';

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Expected YYYY-MM-DD');

export const createWeightSchema = z.object({
  measuredOn: isoDate,
  measuredAt: z.iso.datetime({ offset: true }).optional(),
  weightKg: z.number().positive().max(500),
  heightCm: z.number().positive().max(300).default(175),
  bodyFatPercent: z.number().min(0).max(100).optional(),
  sourceProvider: z.string().min(1).default('manual'),
  sourceRecordId: z.string().min(1).optional(),
  notes: z.string().max(2000).optional()
});

export type CreateWeightInput = z.infer<typeof createWeightSchema>;

export const weightListQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(500).default(100)
});
