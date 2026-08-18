import type { FitnessSupabaseClient } from '../../lib/supabase.js';
import type { Database, Json } from '../../types/database.types.js';
import { RepositoryError } from '../../shared/errors.js';
import type { AppleHealthWorkoutSamplePayload } from '../../integrations/apple-health/apple-health.schema.js';

type MetricInsert = Database['public']['Tables']['workout_metric_samples']['Insert'];
type MetricRow = Database['public']['Tables']['workout_metric_samples']['Row'];

const CHUNK_SIZE = 500;
const READ_PAGE_SIZE = 1000;

export class WorkoutMetricRepository {
  constructor(private readonly supabase: FitnessSupabaseClient) {}

  async listByWorkout(
    workoutId: string,
    metricName = 'heart_rate',
    limit = 5000
  ): Promise<MetricRow[]> {
    const rows: MetricRow[] = [];

    for (let offset = 0; rows.length < limit; offset += READ_PAGE_SIZE) {
      const pageSize = Math.min(READ_PAGE_SIZE, limit - rows.length);
      const { data, error } = await this.supabase
        .from('workout_metric_samples')
        .select('*')
        .eq('workout_id', workoutId)
        .eq('metric_name', metricName)
        .order('sampled_at', { ascending: true })
        .order('id', { ascending: true })
        .range(offset, offset + pageSize - 1);

      if (error) {
        throw new RepositoryError('Failed to load workout metric samples', error.message);
      }

      const page = data ?? [];
      rows.push(...page);
      if (page.length < pageSize) break;
    }

    return rows;
  }

  async listByWorkoutMany(
    workoutId: string,
    metricNames: string[],
    limit = 50000
  ): Promise<MetricRow[]> {
    if (metricNames.length === 0) return [];

    const rows: MetricRow[] = [];

    for (let offset = 0; rows.length < limit; offset += READ_PAGE_SIZE) {
      const pageSize = Math.min(READ_PAGE_SIZE, limit - rows.length);
      const { data, error } = await this.supabase
        .from('workout_metric_samples')
        .select('*')
        .eq('workout_id', workoutId)
        .in('metric_name', metricNames)
        .order('sampled_at', { ascending: true })
        .order('id', { ascending: true })
        .range(offset, offset + pageSize - 1);

      if (error) {
        throw new RepositoryError('Failed to load workout metric samples', error.message);
      }

      const page = data ?? [];
      rows.push(...page);
      if (page.length < pageSize) break;
    }

    return rows;
  }

  async pageByWorkoutMany(
    workoutId: string,
    metricNames: string[],
    page: number,
    pageSize: number
  ): Promise<{ items: MetricRow[]; nextPage: number | null }> {
    if (metricNames.length === 0) return { items: [], nextPage: null };

    const offset = (page - 1) * pageSize;
    const fetchSize = pageSize + 1;
    const { data, error } = await this.supabase
      .from('workout_metric_samples')
      .select('*')
      .eq('workout_id', workoutId)
      .in('metric_name', metricNames)
      .order('sampled_at', { ascending: true })
      .order('id', { ascending: true })
      .range(offset, offset + fetchSize - 1);

    if (error) {
      throw new RepositoryError('Failed to page workout metric samples', error.message);
    }

    const rows = data ?? [];
    const hasMore = rows.length > pageSize;
    return {
      items: rows.slice(0, pageSize),
      nextPage: hasMore ? page + 1 : null
    };
  }

  async upsertAppleHealthSamples(
    workoutId: string,
    workoutStartedAt: string,
    samples: AppleHealthWorkoutSamplePayload[]
  ): Promise<number> {
    if (samples.length === 0) return 0;

    const workoutStartMs = new Date(workoutStartedAt).getTime();
    let processed = 0;

    for (let index = 0; index < samples.length; index += CHUNK_SIZE) {
      const chunk = samples.slice(index, index + CHUNK_SIZE);

      const rows: MetricInsert[] = chunk.map((sample) => ({
        workout_id: workoutId,
        metric_name: sample.metric,
        sampled_at: sample.sampledAt,
        sample_ended_at: sample.sampleEndedAt ?? null,
        elapsed_seconds: Math.max(
          0,
          Math.round((new Date(sample.sampledAt).getTime() - workoutStartMs) / 1000)
        ),
        value: sample.value,
        unit: sample.unit,
        source_provider: 'apple_health',
        source_record_id: sample.sourceRecordId,
        association_kind: sample.associationKind,
        source_name: sample.sourceName ?? null,
        source_bundle_identifier: sample.sourceBundleIdentifier ?? null,
        aggregation: sample.aggregation,
        raw_payload: sample as unknown as Json
      }));

      const { error } = await this.supabase
        .from('workout_metric_samples')
        .upsert(rows, {
          onConflict: 'source_provider,source_record_id'
        });

      if (error) {
        throw new RepositoryError(
          'Failed to save Apple Health workout samples',
          error.message
        );
      }

      processed += rows.length;
    }

    return processed;
  }
}
