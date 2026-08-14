import type { FastifyInstance } from 'fastify';
import { createWeightSchema, weightListQuerySchema } from './weight.schema.js';
import type { WeightService } from './weight.service.js';

export async function registerWeightRoutes(
  app: FastifyInstance,
  service: WeightService
): Promise<void> {
  app.get('/api/v1/weights', async (request) => {
    const query = weightListQuerySchema.parse(request.query);
    return service.list(query.limit);
  });

  app.post('/api/v1/weights', async (request, reply) => {
    const input = createWeightSchema.parse(request.body);
    const result = await service.create(input);
    return reply.code(201).send(result);
  });
}
