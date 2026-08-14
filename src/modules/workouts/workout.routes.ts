import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { createWorkoutSchema, workoutListQuerySchema } from './workout.schema.js';
import type { WorkoutService } from './workout.service.js';

const workoutParamsSchema = z.object({
  id: z.uuid()
});

export async function registerWorkoutRoutes(
  app: FastifyInstance,
  service: WorkoutService
): Promise<void> {
  app.get('/api/v1/workouts', async (request) => {
    const query = workoutListQuerySchema.parse(request.query);
    return service.list(query.limit, query.activityType);
  });

  app.get('/api/v1/workouts/:id', async (request) => {
    const { id } = workoutParamsSchema.parse(request.params);
    return service.getById(id);
  });

  app.post('/api/v1/workouts', async (request, reply) => {
    const input = createWorkoutSchema.parse(request.body);
    const result = await service.create(input);
    return reply.code(201).send(result);
  });
}
