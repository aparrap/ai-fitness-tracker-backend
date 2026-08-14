import type { FastifyInstance } from 'fastify';
import type { StatsService } from './stats.service.js';

export async function registerStatsRoutes(
  app: FastifyInstance,
  service: StatsService
): Promise<void> {
  app.get('/api/v1/stats/summary', async () => service.summary());
}
