import { describe, expect, it } from 'vitest';
import { analyseHrPace } from '../src/modules/fitness-analytics/hr-pace.service.js';
import type { AnalysisSample } from '../src/modules/fitness-analytics/fitness-analytics.types.js';

describe('HR/pace observed duration', () => {
  it('counts supported intervals rather than grid points', () => {
    const startMs = Date.parse('2026-08-14T07:00:00Z');
    const samples: AnalysisSample[] = [];

    for (let elapsed = 0; elapsed <= 600; elapsed += 5) {
      const sampledAt = new Date(startMs + elapsed * 1000).toISOString();
      samples.push(
        {
          metricName: 'heart_rate',
          sampledAt,
          value: 145,
          aggregation: 'instantaneous'
        },
        {
          metricName: 'running_speed',
          sampledAt,
          value: 1000 / 450,
          aggregation: 'instantaneous'
        }
      );
    }

    expect(analyseHrPace(samples).analysedDurationSeconds).toBe(600);
  });

  it('does not bridge disconnected grid segments', () => {
    const startMs = Date.parse('2026-08-14T07:00:00Z');
    const samples: AnalysisSample[] = [];

    for (const elapsed of [0, 5, 10, 60, 65, 70]) {
      const sampledAt = new Date(startMs + elapsed * 1000).toISOString();
      samples.push(
        {
          metricName: 'heart_rate',
          sampledAt,
          value: 145,
          aggregation: 'instantaneous'
        },
        {
          metricName: 'running_speed',
          sampledAt,
          value: 2.2,
          aggregation: 'instantaneous'
        }
      );
    }

    expect(analyseHrPace(samples).analysedDurationSeconds).toBe(20);
  });
});
