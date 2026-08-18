import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import type { WorkoutService } from '../workouts/workout.service.js';
import type { WorkoutMetricRepository } from './workout-metric.repository.js';

const paramsSchema = z.object({
  id: z.uuid()
});

const querySchema = z.object({
  metric: z.string().min(1).default('heart_rate'),
  limit: z.coerce.number().int().min(1).max(50000).default(5000)
});

const samplesQuerySchema = z.object({
  metrics: z.string().default('heart_rate,running_speed,distance'),
  page: z.coerce.number().int().min(1).max(100000).default(1),
  pageSize: z.coerce.number().int().min(1).max(500).default(250)
});

export async function registerWorkoutMetricRoutes(
  app: FastifyInstance,
  workoutService: WorkoutService,
  metricRepository: WorkoutMetricRepository
): Promise<void> {
  app.get('/api/v1/workouts/:id/metrics', async (request) => {
    const { id } = paramsSchema.parse(request.params);
    const query = querySchema.parse(request.query);

    // Ensures the workout belongs to the configured profile before returning samples.
    await workoutService.getById(id);

    return metricRepository.listByWorkout(id, query.metric, query.limit);
  });

  app.get('/api/v1/workouts/:id/samples', async (request) => {
    const { id } = paramsSchema.parse(request.params);
    const query = samplesQuerySchema.parse(request.query);
    await workoutService.getById(id);

    const metrics: string[] = Array.from(
      new Set<string>(
        query.metrics
          .split(',')
          .map((metric: string) => metric.trim())
          .filter(Boolean)
      )
    );

    const result = await metricRepository.pageByWorkoutMany(
      id,
      metrics,
      query.page,
      query.pageSize
    );

    return {
      items: result.items,
      page: query.page,
      pageSize: query.pageSize,
      nextPage: result.nextPage
    };
  });
}
