import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import type { WorkoutService } from '../workouts/workout.service.js';
import type { WorkoutCoachingService } from './workout-coaching.service.js';

const paramsSchema = z.object({ id: z.uuid() });

export async function registerCoachingRoutes(
  app: FastifyInstance,
  workoutService: WorkoutService,
  coachingService: WorkoutCoachingService
): Promise<void> {
  app.get('/api/v1/workouts/:id/coaching', async (request) => {
    const { id } = paramsSchema.parse(request.params);
    await workoutService.getById(id);
    return {
      workoutId: id,
      evaluation: await coachingService.getLatest(id)
    };
  });
}
