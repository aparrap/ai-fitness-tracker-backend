import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import type { WorkoutService } from '../workouts/workout.service.js';
import type { WorkoutSplitService } from './workout-split.service.js';

const paramsSchema = z.object({ id: z.uuid() });

export async function registerWorkoutSplitRoutes(
  app: FastifyInstance,
  workoutService: WorkoutService,
  splitService: WorkoutSplitService
): Promise<void> {
  app.get('/api/v1/workouts/:id/splits', async (request) => {
    const { id } = paramsSchema.parse(request.params);
    await workoutService.getById(id);
    return splitService.list(id);
  });
}
