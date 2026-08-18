import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import type { WorkoutAnalysisService } from './workout-analysis.service.js';
import type { RunningTrendService } from './running-trend.service.js';

const paramsSchema = z.object({ id: z.uuid() });

export async function registerFitnessAnalyticsRoutes(
  app: FastifyInstance,
  workoutAnalysisService: WorkoutAnalysisService,
  runningTrendService: RunningTrendService
): Promise<void> {
  app.get('/api/v1/workouts/:id/analysis', async (request) => {
    const { id } = paramsSchema.parse(request.params);
    return workoutAnalysisService.analyse(id);
  });

  app.get('/api/v1/analytics/running-efficiency', async () => {
    return runningTrendService.getRunningEfficiencyTrends();
  });
}
