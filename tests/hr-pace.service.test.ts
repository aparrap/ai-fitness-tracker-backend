import { describe, expect, it } from 'vitest';
import { analyseHrPace } from '../src/modules/fitness-analytics/hr-pace.service.js';
import type { AnalysisSample } from '../src/modules/fitness-analytics/fitness-analytics.types.js';

function buildConstantRun(params: {
  durationSeconds: number;
  speedMps: number;
  heartRate: (elapsedSeconds: number) => number;
}): AnalysisSample[] {
  const startMs = Date.parse('2026-08-14T07:00:00Z');
  const samples: AnalysisSample[] = [];

  for (let elapsed = 0; elapsed <= params.durationSeconds; elapsed += 5) {
    const sampledAt = new Date(startMs + elapsed * 1000).toISOString();
    samples.push({
      metricName: 'heart_rate',
      sampledAt,
      value: params.heartRate(elapsed),
      aggregation: 'instantaneous'
    });
    samples.push({
      metricName: 'running_speed',
      sampledAt,
      value: params.speedMps,
      aggregation: 'instantaneous'
    });
  }

  return samples;
}

describe('HR vs pace analysis', () => {
  it('calculates pace around 145 bpm from timestamped series', () => {
    const analysis = analyseHrPace(
      buildConstantRun({
        durationSeconds: 600,
        speedMps: 1000 / 450,
        heartRate: () => 145
      })
    );

    expect(analysis.speedSource).toBe('running_speed');
    expect(analysis.hrPaceBands.find((band) => band.targetBpm === 145)).toMatchObject({
      paceSecondsPerKm: 450,
      avgHeartRateBpm: 145
    });
    expect(analysis.aerobicEfficiencyMetersPerHeartbeat).toBeCloseTo(0.9195, 3);
  });

  it('detects positive heart-rate drift when HR rises at the same speed', () => {
    const analysis = analyseHrPace(
      buildConstantRun({
        durationSeconds: 1200,
        speedMps: 2.2,
        heartRate: (elapsed) => (elapsed < 600 ? 140 : 150)
      })
    );

    expect(analysis.heartRateDrift.changeBpm).toBeGreaterThan(9);
    expect(analysis.heartRateDrift.aerobicDecouplingPercent).toBeGreaterThan(5);
  });

  it('falls back to distance when native speed covers only a small part of the run', () => {
    const startMs = Date.parse('2026-08-14T07:00:00Z');
    const samples: AnalysisSample[] = [];
    const speedMps = 1000 / 450;

    for (let elapsed = 0; elapsed <= 600; elapsed += 5) {
      samples.push({
        metricName: 'heart_rate',
        sampledAt: new Date(startMs + elapsed * 1000).toISOString(),
        value: 145,
        aggregation: 'instantaneous'
      });

      if (elapsed < 600) {
        samples.push({
          metricName: 'distance',
          sampledAt: new Date(startMs + elapsed * 1000).toISOString(),
          sampleEndedAt: new Date(startMs + (elapsed + 5) * 1000).toISOString(),
          value: speedMps * 5,
          aggregation: 'interval_delta'
        });
      }
    }

    samples.push(
      {
        metricName: 'running_speed',
        sampledAt: new Date(startMs).toISOString(),
        value: speedMps,
        aggregation: 'instantaneous'
      },
      {
        metricName: 'running_speed',
        sampledAt: new Date(startMs + 10_000).toISOString(),
        value: speedMps,
        aggregation: 'instantaneous'
      }
    );

    const analysis = analyseHrPace(samples);
    expect(analysis.speedSource).toBe('distance');
    expect(analysis.analysedDurationSeconds).toBeGreaterThan(500);
    expect(analysis.hrPaceBands.find((band) => band.targetBpm === 145)?.paceSecondsPerKm)
      .toBeCloseTo(450, 1);
  });

  it('does not count a long interior telemetry gap as analysed running time', () => {
    const startMs = Date.parse('2026-08-14T07:00:00Z');
    const samples: AnalysisSample[] = [];
    const speedMps = 1000 / 450;

    for (const elapsed of [0, 5, 10, 15, 20, 65, 70, 75, 80]) {
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
          value: speedMps,
          aggregation: 'instantaneous'
        }
      );
    }

    const analysis = analyseHrPace(samples);
    // The 45-second interior hole must not be filled onto the five-second grid.
    expect(analysis.analysedDurationSeconds).toBeLessThan(80);
  });
});
