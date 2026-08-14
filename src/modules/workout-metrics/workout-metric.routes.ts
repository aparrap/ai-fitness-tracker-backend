import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import type { WorkoutService } from '../workouts/workout.service.js';
import type { WorkoutMetricRepository } from './workout-metric.repository.js';

const paramsSchema = z.object({
  id: z.uuid()
});

const querySchema = z.object({
  metric: z.string().min(1).default('heart_rate'),
  limit: z.coerce.number().int().min(1).max(20000).default(5000)
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
}
