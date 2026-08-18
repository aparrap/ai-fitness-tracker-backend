import { describe, expect, it } from 'vitest';
import type { Database } from '../src/types/database.types.js';
import {
  buildDistanceTimeline,
  generateKilometreSplits
} from '../src/modules/workout-splits/workout-split.service.js';

type MetricRow = Database['public']['Tables']['workout_metric_samples']['Row'];

function metric(partial: Partial<MetricRow> & Pick<MetricRow, 'metric_name' | 'value'>): MetricRow {
  return {
    id: 1,
    workout_id: '00000000-0000-0000-0000-000000000001',
    sampled_at: null,
    sample_ended_at: null,
    elapsed_seconds: null,
    unit: partial.metric_name === 'heart_rate' ? 'bpm' : 'm',
    source_provider: 'apple_health',
    source_record_id: crypto.randomUUID(),
    association_kind: 'workout_associated',
    source_name: null,
    source_bundle_identifier: null,
    raw_payload: null,
    created_at: '2026-08-14T07:00:00Z',
    ...partial
  };
}

describe('kilometre split generation', () => {
  it('interpolates kilometre boundaries and calculates HR summaries', () => {
    const start = Date.parse('2026-08-14T07:00:00Z');
    const metrics: MetricRow[] = [];

    for (let segment = 0; segment < 8; segment += 1) {
      const segmentStart = start + segment * 112_500;
      const segmentEnd = segmentStart + 112_500;
      metrics.push(
        metric({
          id: segment + 1,
          metric_name: 'distance',
          value: 250,
          sampled_at: new Date(segmentStart).toISOString(),
          sample_ended_at: new Date(segmentEnd).toISOString(),
          source_record_id: `distance-${segment}`,
          raw_payload: { aggregation: 'interval_delta' }
        })
      );
    }

    for (let elapsed = 0; elapsed <= 900; elapsed += 30) {
      metrics.push(
        metric({
          id: 100 + elapsed,
          metric_name: 'heart_rate',
          value: 140 + elapsed / 300,
          sampled_at: new Date(start + elapsed * 1000).toISOString(),
          source_record_id: `hr-${elapsed}`
        })
      );
    }

    const timeline = buildDistanceTimeline(
      { started_at: new Date(start).toISOString() },
      metrics
    );
    expect(timeline).not.toBeNull();

    const splits = generateKilometreSplits(timeline!, metrics);
    expect(splits).toHaveLength(2);
    expect(splits[0]?.duration_seconds).toBeCloseTo(450, 2);
    expect(splits[0]?.avg_pace_seconds_per_km).toBeCloseTo(450, 2);
    expect(splits[0]?.avg_heart_rate_bpm).not.toBeNull();
    expect(splits[1]?.split_number).toBe(2);
  });
});
