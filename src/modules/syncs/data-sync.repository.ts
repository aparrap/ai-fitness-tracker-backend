import type { FitnessSupabaseClient } from '../../lib/supabase.js';
import type { Database, Json } from '../../types/database.types.js';
import { RepositoryError } from '../../shared/errors.js';

type DataSyncRow = Database['public']['Tables']['data_syncs']['Row'];

export type SyncCounts = {
  weightsProcessed: number;
  workoutsProcessed: number;
  workoutsMatched: number;
  workoutsDeleted: number;
  metricSamplesProcessed: number;
};

export class DataSyncRepository {
  constructor(
    private readonly supabase: FitnessSupabaseClient,
    private readonly profileId: string
  ) {}

  async find(provider: string, clientSyncId: string): Promise<DataSyncRow | null> {
    const { data, error } = await this.supabase
      .from('data_syncs')
      .select('*')
      .eq('profile_id', this.profileId)
      .eq('provider', provider)
      .eq('client_sync_id', clientSyncId)
      .maybeSingle();

    if (error) {
      throw new RepositoryError('Failed to inspect sync state', error.message);
    }

    return data;
  }

  async listRecent(provider: string, limit = 20): Promise<DataSyncRow[]> {
    const { data, error } = await this.supabase
      .from('data_syncs')
      .select('*')
      .eq('profile_id', this.profileId)
      .eq('provider', provider)
      .order('started_at', { ascending: false })
      .limit(limit);

    if (error) {
      throw new RepositoryError('Failed to load sync history', error.message);
    }

    return data ?? [];
  }

  async start(
    provider: string,
    clientSyncId: string,
    deviceMetadata: Json | null
  ): Promise<DataSyncRow> {
    const now = new Date().toISOString();

    const { data, error } = await this.supabase
      .from('data_syncs')
      .upsert(
        {
          profile_id: this.profileId,
          provider,
          client_sync_id: clientSyncId,
          status: 'processing',
          device_metadata: deviceMetadata,
          error_message: null,
          started_at: now,
          completed_at: null,
          updated_at: now
        },
        {
          onConflict: 'profile_id,provider,client_sync_id'
        }
      )
      .select('*')
      .single();

    if (error) {
      throw new RepositoryError('Failed to start sync', error.message);
    }

    return data;
  }

  async complete(id: string, counts: SyncCounts): Promise<void> {
    const now = new Date().toISOString();

    const { error } = await this.supabase
      .from('data_syncs')
      .update({
        status: 'completed',
        weights_processed: counts.weightsProcessed,
        workouts_processed: counts.workoutsProcessed,
        workouts_matched: counts.workoutsMatched,
        workouts_deleted: counts.workoutsDeleted,
        metric_samples_processed: counts.metricSamplesProcessed,
        error_message: null,
        completed_at: now,
        updated_at: now
      })
      .eq('id', id)
      .eq('profile_id', this.profileId);

    if (error) {
      throw new RepositoryError('Failed to complete sync', error.message);
    }
  }

  async fail(id: string, message: string): Promise<void> {
    const now = new Date().toISOString();

    const { error } = await this.supabase
      .from('data_syncs')
      .update({
        status: 'failed',
        error_message: message.slice(0, 4000),
        completed_at: now,
        updated_at: now
      })
      .eq('id', id)
      .eq('profile_id', this.profileId);

    if (error) {
      throw new RepositoryError('Failed to record sync failure', error.message);
    }
  }
}
