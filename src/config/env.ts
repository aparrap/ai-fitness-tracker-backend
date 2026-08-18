import 'dotenv/config';
import { z } from 'zod';

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  HOST: z.string().default('0.0.0.0'),
  PORT: z.coerce.number().int().positive().default(3000),
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent']).default('info'),
  SUPABASE_URL: z.url(),
  SUPABASE_SECRET_KEY: z.string().min(1),
  FITNESS_PROFILE_ID: z.uuid(),
  APPLE_HEALTH_INGEST_API_KEY: z.string().min(32),
  OPENAI_API_KEY: z.string().min(1).optional(),
  OPENAI_COACH_MODEL: z.string().min(1).default('gpt-5.6-luna'),
  CORS_ORIGIN: z.string().default('http://localhost:3001')
});

export type AppEnv = z.infer<typeof envSchema>;

export function loadEnv(source: NodeJS.ProcessEnv = process.env): AppEnv {
  const parsed = envSchema.safeParse(source);

  if (!parsed.success) {
    console.error('Invalid environment configuration:', z.treeifyError(parsed.error));
    throw new Error('Invalid environment configuration');
  }

  return parsed.data;
}
