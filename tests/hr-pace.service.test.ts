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
});
