import { buildApp } from './app.js';
import { loadEnv } from './config/env.js';
import { createSupabaseClient } from './lib/supabase.js';

const env = loadEnv();
const supabase = createSupabaseClient(env);

const app = await buildApp({
  supabase,
  profileId: env.FITNESS_PROFILE_ID,
  corsOrigin: env.CORS_ORIGIN,
  appleHealthIngestApiKey: env.APPLE_HEALTH_INGEST_API_KEY,
  logLevel: env.LOG_LEVEL
});

async function shutdown(signal: string): Promise<void> {
  app.log.info({ signal }, 'Shutting down');
  await app.close();
  process.exit(0);
}

process.on('SIGINT', () => void shutdown('SIGINT'));
process.on('SIGTERM', () => void shutdown('SIGTERM'));

try {
  await app.listen({
    host: env.HOST,
    port: env.PORT
  });
} catch (error) {
  app.log.error(error);
  process.exit(1);
}
