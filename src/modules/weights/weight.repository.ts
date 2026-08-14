import type { FitnessSupabaseClient } from '../../lib/supabase.js';
import type { Database } from '../../types/database.types.js';
import { RepositoryError } from '../../shared/errors.js';

type WeightRow = Database['public']['Tables']['body_measurements']['Row'];
type WeightInsert = Database['public']['Tables']['body_measurements']['Insert'];

export class WeightRepository {
  constructor(
    private readonly supabase: FitnessSupabaseClient,
    private readonly profileId: string
  ) {}

  async list(limit = 100): Promise<WeightRow[]> {
    const { data, error } = await this.supabase
      .from('body_measurements')
      .select('*')
      .eq('profile_id', this.profileId)
      .not('weight_kg', 'is', null)
      .order('measured_on', { ascending: false })
      .limit(limit);

    if (error) {
      throw new RepositoryError('Failed to load weight measurements', error.message);
    }

    return data ?? [];
  }

  async upsert(input: WeightInsert): Promise<WeightRow> {
    const { data, error } = await this.supabase
      .from('body_measurements')
      .upsert(input, {
        onConflict: 'profile_id,source_provider,source_record_id'
      })
      .select('*')
      .single();

    if (error) {
      throw new RepositoryError('Failed to save weight measurement', error.message);
    }

    return data;
  }
}
