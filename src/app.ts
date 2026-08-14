import cors from '@fastify/cors';
import Fastify, { type FastifyInstance } from 'fastify';
import { ZodError } from 'zod';
import type { FitnessSupabaseClient } from './lib/supabase.js';
import { NotFoundError, RepositoryError } from './shared/errors.js';
import { WeightRepository } from './modules/weights/weight.repository.js';
import { WeightService } from './modules/weights/weight.service.js';
import { registerWeightRoutes } from './modules/weights/weight.routes.js';
import { WorkoutRepository } from './modules/workouts/workout.repository.js';
import { WorkoutService } from './modules/workouts/workout.service.js';
import { registerWorkoutRoutes } from './modules/workouts/workout.routes.js';
import { StatsService } from './modules/stats/stats.service.js';
import { registerStatsRoutes } from './modules/stats/stats.routes.js';

export type BuildAppOptions = {
  supabase: FitnessSupabaseClient;
  profileId: string;
  corsOrigin: string;
  logLevel?: string;
};

export async function buildApp(options: BuildAppOptions): Promise<FastifyInstance> {
  const app = Fastify({
    logger: {
      level: options.logLevel ?? 'info'
    }
  });

  await app.register(cors, {
    origin:
      options.corsOrigin === '*'
        ? true
        : options.corsOrigin.split(',').map((origin) => origin.trim())
  });

  const weightRepository = new WeightRepository(options.supabase, options.profileId);
  const workoutRepository = new WorkoutRepository(options.supabase, options.profileId);

  const weightService = new WeightService(weightRepository, options.profileId);
  const workoutService = new WorkoutService(workoutRepository, options.profileId);
  const statsService = new StatsService(weightRepository, workoutRepository);

  app.get('/health', async () => ({
    status: 'ok',
    service: 'ai-fitness-tracker-backend'
  }));

  await registerWeightRoutes(app, weightService);
  await registerWorkoutRoutes(app, workoutService);
  await registerStatsRoutes(app, statsService);

  app.setErrorHandler((error, request, reply) => {
    if (error instanceof ZodError) {
      return reply.code(400).send({
        error: 'validation_error',
        message: 'Request validation failed',
        details: error.issues
      });
    }

    if (error instanceof NotFoundError) {
      return reply.code(404).send({
        error: 'not_found',
        message: error.message
      });
    }

    if (error instanceof RepositoryError) {
      request.log.error(
        { err: error, causeMessage: error.causeMessage },
        'Repository operation failed'
      );

      return reply.code(500).send({
        error: 'database_error',
        message: error.message
      });
    }

    request.log.error({ err: error }, 'Unhandled request error');

    return reply.code(500).send({
      error: 'internal_server_error',
      message: 'An unexpected error occurred'
    });
  });

  return app;
}
