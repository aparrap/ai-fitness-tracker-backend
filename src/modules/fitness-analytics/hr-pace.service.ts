import type {
  AlignedRunningPoint,
  AnalysisSample,
  HeartRateBySpeedBucket,
  HrPaceBand,
  RunningPhysiologyAnalysis
} from './fitness-analytics.types.js';

type NumericPoint = { timestampMs: number; value: number };

const GRID_SECONDS = 5;
const MAX_INTERPOLATION_GAP_MS = 30_000;
const MIN_BAND_SECONDS = 120;
const HR_BAND_WIDTH = 2;
const SPEED_BUCKET_MPS = 0.25;

function round(value: number, digits = 2): number {
  const multiplier = 10 ** digits;
  return Math.round(value * multiplier) / multiplier;
}

function average(values: number[]): number | null {
  if (values.length === 0) return null;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function median(values: number[]): number | null {
  if (values.length === 0) return null;
  const ordered = [...values].sort((a, b) => a - b);
  const midpoint = Math.floor(ordered.length / 2);
  if (ordered.length % 2 === 1) return ordered[midpoint]!;
  return (ordered[midpoint - 1]! + ordered[midpoint]!) / 2;
}

function coefficientOfVariation(values: number[]): number | null {
  const mean = average(values);
  if (mean === null || mean === 0 || values.length < 2) return null;
  const variance =
    values.reduce((sum, value) => sum + (value - mean) ** 2, 0) / values.length;
  return Math.sqrt(variance) / mean;
}

function timestamp(value: string | null): number | null {
  if (!value) return null;
  const parsed = new Date(value).getTime();
  return Number.isFinite(parsed) ? parsed : null;
}

function toPoints(samples: AnalysisSample[], metricName: string): NumericPoint[] {
  return samples
    .filter((sample) => sample.metricName === metricName)
    .map((sample) => ({ timestampMs: timestamp(sample.sampledAt), value: sample.value }))
    .filter(
      (point): point is { timestampMs: number; value: number } =>
        point.timestampMs !== null && Number.isFinite(point.value)
    )
    .sort((a, b) => a.timestampMs - b.timestampMs);
}

function distanceToSpeedPoints(samples: AnalysisSample[]): NumericPoint[] {
  const distanceSamples = samples
    .filter((sample) => sample.metricName === 'distance' && sample.value >= 0)
    .map((sample) => ({ ...sample, timestampMs: timestamp(sample.sampledAt) }))
    .filter(
      (sample): sample is AnalysisSample & { timestampMs: number } =>
        sample.timestampMs !== null
    )
    .sort((a, b) => a.timestampMs - b.timestampMs);

  if (distanceSamples.length === 0) return [];

  const cumulativeMode = distanceSamples.some(
    (sample) => sample.aggregation === 'cumulative'
  );
  const points: NumericPoint[] = [];

  if (cumulativeMode) {
    for (let index = 1; index < distanceSamples.length; index += 1) {
      const previous = distanceSamples[index - 1]!;
      const current = distanceSamples[index]!;
      const seconds = (current.timestampMs - previous.timestampMs) / 1000;
      if (seconds <= 0 || seconds > 120) continue;
      const distanceDelta = Math.max(0, current.value - previous.value);
      points.push({
        timestampMs: Math.round((previous.timestampMs + current.timestampMs) / 2),
        value: distanceDelta / seconds
      });
    }

    return points;
  }

  for (let index = 0; index < distanceSamples.length; index += 1) {
    const sample = distanceSamples[index]!;
    const endedAtMs = timestamp(sample.sampleEndedAt ?? null);
    const nextStartedAtMs = distanceSamples[index + 1]?.timestampMs;
    const intervalEndMs =
      endedAtMs !== null && endedAtMs > sample.timestampMs
        ? endedAtMs
        : nextStartedAtMs;

    if (intervalEndMs === undefined || intervalEndMs <= sample.timestampMs) continue;
    const seconds = (intervalEndMs - sample.timestampMs) / 1000;
    if (seconds <= 0 || seconds > 120) continue;

    points.push({
      timestampMs: Math.round((sample.timestampMs + intervalEndMs) / 2),
      value: sample.value / seconds
    });
  }

  return points;
}

function interpolate(points: NumericPoint[], targetMs: number): number | null {
  if (points.length === 0) return null;

  let rightIndex = points.findIndex((point) => point.timestampMs >= targetMs);
  if (rightIndex === -1) rightIndex = points.length - 1;
  const right = points[rightIndex]!;
  const left = points[Math.max(0, rightIndex - 1)]!;

  if (left.timestampMs === right.timestampMs) {
    return Math.abs(left.timestampMs - targetMs) <= MAX_INTERPOLATION_GAP_MS
      ? left.value
      : null;
  }

  if (
    targetMs < left.timestampMs ||
    targetMs > right.timestampMs ||
    right.timestampMs - left.timestampMs > MAX_INTERPOLATION_GAP_MS
  ) {
    const nearest =
      Math.abs(targetMs - left.timestampMs) <= Math.abs(targetMs - right.timestampMs)
        ? left
        : right;
    return Math.abs(nearest.timestampMs - targetMs) <= MAX_INTERPOLATION_GAP_MS
      ? nearest.value
      : null;
  }

  const fraction = (targetMs - left.timestampMs) / (right.timestampMs - left.timestampMs);
  return left.value + (right.value - left.value) * fraction;
}

export function alignHeartRateAndPace(samples: AnalysisSample[]): {
  points: AlignedRunningPoint[];
  speedSource: 'running_speed' | 'distance' | null;
} {
  const heartRatePoints = toPoints(samples, 'heart_rate').filter(
    (point) => point.value > 0 && point.value <= 260
  );
  const directSpeedPoints = toPoints(samples, 'running_speed').filter(
    (point) => point.value >= 0
  );
  const speedPoints =
    directSpeedPoints.length >= 2 ? directSpeedPoints : distanceToSpeedPoints(samples);
  const speedSource =
    directSpeedPoints.length >= 2
      ? 'running_speed'
      : speedPoints.length >= 2
        ? 'distance'
        : null;

  if (heartRatePoints.length < 2 || speedPoints.length < 2 || speedSource === null) {
    return { points: [], speedSource };
  }

  const startMs = Math.max(
    heartRatePoints[0]!.timestampMs,
    speedPoints[0]!.timestampMs
  );
  const endMs = Math.min(
    heartRatePoints.at(-1)!.timestampMs,
    speedPoints.at(-1)!.timestampMs
  );
  if (endMs <= startMs) return { points: [], speedSource };

  const aligned: AlignedRunningPoint[] = [];
  for (let currentMs = startMs; currentMs <= endMs; currentMs += GRID_SECONDS * 1000) {
    const heartRateBpm = interpolate(heartRatePoints, currentMs);
    const speedMps = interpolate(speedPoints, currentMs);
    if (heartRateBpm === null || speedMps === null || speedMps < 0.5) continue;

    aligned.push({
      sampledAt: new Date(currentMs).toISOString(),
      heartRateBpm: round(heartRateBpm),
      speedMps: round(speedMps, 4),
      paceSecondsPerKm: round(1000 / speedMps),
      efficiencyMetersPerHeartbeat: round((speedMps * 60) / heartRateBpm, 4)
    });
  }

  return { points: aligned, speedSource };
}

function buildHrPaceBand(points: AlignedRunningPoint[], targetBpm: number): HrPaceBand {
  const matching = points.filter(
    (point) => Math.abs(point.heartRateBpm - targetBpm) <= HR_BAND_WIDTH
  );
  const durationSeconds = matching.length * GRID_SECONDS;
  const sufficient = durationSeconds >= MIN_BAND_SECONDS;
  const averageHeartRate = average(matching.map((point) => point.heartRateBpm));
  const averageSpeed = average(matching.map((point) => point.speedMps));
  const medianPace = median(matching.map((point) => point.paceSecondsPerKm));

  return {
    targetBpm,
    minBpm: targetBpm - HR_BAND_WIDTH,
    maxBpm: targetBpm + HR_BAND_WIDTH,
    sampleCount: matching.length,
    durationSeconds,
    avgHeartRateBpm: sufficient && averageHeartRate !== null ? round(averageHeartRate) : null,
    avgSpeedMps: sufficient && averageSpeed !== null ? round(averageSpeed, 4) : null,
    paceSecondsPerKm: sufficient && medianPace !== null ? round(medianPace) : null
  };
}

function buildHeartRateBySpeed(points: AlignedRunningPoint[]): HeartRateBySpeedBucket[] {
  const buckets = new Map<number, AlignedRunningPoint[]>();

  for (const point of points) {
    const bucket = Math.round(point.speedMps / SPEED_BUCKET_MPS) * SPEED_BUCKET_MPS;
    const existing = buckets.get(bucket) ?? [];
    existing.push(point);
    buckets.set(bucket, existing);
  }

  return [...buckets.entries()]
    .filter(([, bucketPoints]) => bucketPoints.length * GRID_SECONDS >= MIN_BAND_SECONDS)
    .map(([speedMps, bucketPoints]) => ({
      speedMps: round(speedMps, 2),
      paceSecondsPerKm: round(1000 / speedMps),
      avgHeartRateBpm: round(
        average(bucketPoints.map((point) => point.heartRateBpm))!
      ),
      sampleCount: bucketPoints.length,
      durationSeconds: bucketPoints.length * GRID_SECONDS
    }))
    .sort((a, b) => a.speedMps - b.speedMps);
}

export function analyseHrPace(samples: AnalysisSample[]): RunningPhysiologyAnalysis {
  const { points, speedSource } = alignHeartRateAndPace(samples);
  const midpoint = Math.floor(points.length / 2);
  const firstHalf = points.slice(0, midpoint);
  const secondHalf = points.slice(midpoint);

  const firstHr = average(firstHalf.map((point) => point.heartRateBpm));
  const secondHr = average(secondHalf.map((point) => point.heartRateBpm));
  const firstEfficiency = average(
    firstHalf.map((point) => point.efficiencyMetersPerHeartbeat)
  );
  const secondEfficiency = average(
    secondHalf.map((point) => point.efficiencyMetersPerHeartbeat)
  );
  const averageEfficiency = average(
    points.map((point) => point.efficiencyMetersPerHeartbeat)
  );
  const hrChange = firstHr !== null && secondHr !== null ? secondHr - firstHr : null;

  return {
    alignedSampleCount: points.length,
    analysedDurationSeconds: points.length * GRID_SECONDS,
    speedSource,
    hrPaceBands: [140, 145, 150].map((target) => buildHrPaceBand(points, target)),
    heartRateBySpeed: buildHeartRateBySpeed(points),
    aerobicEfficiencyMetersPerHeartbeat:
      averageEfficiency !== null ? round(averageEfficiency, 4) : null,
    heartRateDrift: {
      firstHalfAvgHeartRateBpm: firstHr !== null ? round(firstHr) : null,
      secondHalfAvgHeartRateBpm: secondHr !== null ? round(secondHr) : null,
      changeBpm: hrChange !== null ? round(hrChange) : null,
      changePercent:
        hrChange !== null && firstHr !== null && firstHr !== 0
          ? round((hrChange / firstHr) * 100)
          : null,
      firstHalfEfficiency:
        firstEfficiency !== null ? round(firstEfficiency, 4) : null,
      secondHalfEfficiency:
        secondEfficiency !== null ? round(secondEfficiency, 4) : null,
      aerobicDecouplingPercent:
        firstEfficiency !== null &&
        secondEfficiency !== null &&
        firstEfficiency !== 0
          ? round(((firstEfficiency - secondEfficiency) / firstEfficiency) * 100)
          : null
    },
    consistency: {
      paceCoefficientOfVariation: (() => {
        const value = coefficientOfVariation(points.map((point) => point.paceSecondsPerKm));
        return value !== null ? round(value, 4) : null;
      })(),
      heartRateCoefficientOfVariation: (() => {
        const value = coefficientOfVariation(points.map((point) => point.heartRateBpm));
        return value !== null ? round(value, 4) : null;
      })()
    }
  };
}
