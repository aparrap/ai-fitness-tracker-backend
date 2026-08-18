import type { FitnessSupabaseClient } from '../../lib/supabase.js';
import type { Database, Json } from '../../types/database.types.js';
import { RepositoryError } from '../../shared/errors.js';
import type { AppleHealthWorkoutSamplePayload } from '../../integrations/apple-health/apple-health.schema.js';

type MetricInsert = Database['public']['Tables']['workout_metric_samples']['Insert'];
type MetricRow = Database['public']['Tables']['workout_metric_samples']['Row'];

const CHUNK_SIZE = 500;

export class WorkoutMetricRepository {
  constructor(private readonly supabase: FitnessSupabaseClient) {}

  async listByWorkout(
    workoutId: string,
    metricName = 'heart_rate',
    limit = 5000
  ): Promise<MetricRow[]> {
    const { data, error } = await this.supabase
      .from('workout_metric_samples')
      .select('*')
      .eq('workout_id', workoutId)
      .eq('metric_name', metricName)
      .order('sampled_at', { ascending: true })
      .limit(limit);

    if (error) {
      throw new RepositoryError('Failed to load workout metric samples', error.message);
    }

    return data ?? [];
  }

  async listByWorkoutMany(
    workoutId: string,
    metricNames: string[],
    limit = 50000
  ): Promise<MetricRow[]> {
    if (metricNames.length === 0) return [];

    const { data, error } = await this.supabase
      .from('workout_metric_samples')
      .select('*')
      .eq('workout_id', workoutId)
      .in('metric_name', metricNames)
      .order('sampled_at', { ascending: true })
      .limit(limit);

    if (error) {
      throw new RepositoryError('Failed to load workout metric samples', error.message);
    }

    return data ?? [];
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
