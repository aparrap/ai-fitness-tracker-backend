import type { FastifyInstance, FastifyRequest } from 'fastify';
import { z } from 'zod';
import { UnauthorizedError } from '../../shared/errors.js';
import { secureCompareApiKey } from '../../shared/api-key.js';
import type { DataSyncRepository } from '../../modules/syncs/data-sync.repository.js';
import { appleHealthImportSchema } from './apple-health.schema.js';
import type { AppleHealthImportService } from './apple-health.import.service.js';

const statusQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(20)
});

function assertIngestKey(request: FastifyRequest, ingestApiKey: string): void {
  const header = request.headers['x-ingest-key'];
  const provided = Array.isArray(header) ? header[0] : header;

  if (!secureCompareApiKey(provided, ingestApiKey)) {
    throw new UnauthorizedError('Invalid Apple Health ingest key');
  }
}

export async function registerAppleHealthRoutes(
  app: FastifyInstance,
  service: AppleHealthImportService,
  syncRepository: DataSyncRepository,
  ingestApiKey: string
): Promise<void> {
  app.post(
    '/api/v1/import/apple-health',
    {
      preHandler: async (request) => assertIngestKey(request, ingestApiKey)
    },
    async (request, reply) => {
      const input = appleHealthImportSchema.parse(request.body);
      const result = await service.import(input);
      return reply.code(200).send(result);
    }
  );

  app.get(
    '/api/v1/import/apple-health/status',
    {
      preHandler: async (request) => assertIngestKey(request, ingestApiKey)
    },
    async (request) => {
      const query = statusQuerySchema.parse(request.query);
      return syncRepository.listRecent('apple_health', query.limit);
    }
  );
}
