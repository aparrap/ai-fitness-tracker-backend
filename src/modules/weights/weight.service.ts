import type { Database } from '../../types/database.types.js';
import type { CreateWeightInput } from './weight.schema.js';
import { WeightRepository } from './weight.repository.js';

type WeightRow = Database['public']['Tables']['body_measurements']['Row'];

export class WeightService {
  constructor(
    private readonly repository: WeightRepository,
    private readonly profileId: string
  ) {}

  list(limit: number): Promise<WeightRow[]> {
    return this.repository.list(limit);
  }

  async create(input: CreateWeightInput): Promise<WeightRow> {
    const sourceRecordId =
      input.sourceRecordId ??
      `api-weight-${input.sourceProvider}-${input.measuredOn}`;

    return this.repository.upsert({
      profile_id: this.profileId,
      measured_on: input.measuredOn,
      measured_at: input.measuredAt ?? null,
      date_precision: input.measuredAt ? 'exact_timestamp' : 'explicit_date',
      weight_kg: input.weightKg,
      height_cm: input.heightCm,
      body_fat_percent: input.bodyFatPercent ?? null,
      source_provider: input.sourceProvider,
      source_record_id: sourceRecordId,
      ingested_via: 'backend_api',
      notes: input.notes ?? null
    });
  }
}
