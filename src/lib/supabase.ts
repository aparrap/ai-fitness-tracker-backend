import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import type { AppEnv } from '../config/env.js';
import type { Database } from '../types/database.types.js';

export type FitnessSupabaseClient = SupabaseClient<Database>;

export function createSupabaseClient(env: AppEnv): FitnessSupabaseClient {
  return createClient<Database>(env.SUPABASE_URL, env.SUPABASE_SECRET_KEY, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false
    }
  });
}
