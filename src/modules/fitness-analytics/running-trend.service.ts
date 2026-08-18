import type { WorkoutService } from '../workouts/workout.service.js';
import type { WorkoutAnalysisService } from './workout-analysis.service.js';

type WorkoutAnalysis = Awaited<ReturnType<WorkoutAnalysisService['analyse']>>;
type WorkoutRow = Awaited<ReturnType<WorkoutService['list']>>[number];
type DatedValue = { timestampMs: number; value: number };

type WorkoutAnalysisPair = {
  workout: WorkoutRow;
  analysis: WorkoutAnalysis;
};

function round(value: number, digits = 2): number {
  const multiplier = 10 ** digits;
  return Math.round(value * multiplier) / multiplier;
}

function average(values: number[]): number | null {
  if (values.length === 0) return null;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function workoutTimestamp(workout: WorkoutRow): number {
  return new Date(workout.started_at ?? `${workout.started_on}T12:00:00Z`).getTime();
}

export function linearTrend(values: DatedValue[]) {
  if (values.length < 2) return null;
  const ordered = [...values].sort((a, b) => a.timestampMs - b.timestampMs);
  const origin = ordered[0]!.timestampMs;
  const points = ordered.map((point) => ({
    x: (point.timestampMs - origin) / 86_400_000,
    y: point.value
  }));
  const xMean = average(points.map((point) => point.x))!;
  const yMean = average(points.map((point) => point.y))!;
  const numerator = points.reduce(
    (sum, point) => sum + (point.x - xMean) * (point.y - yMean),
    0
  );
  const denominator = points.reduce(
    (sum, point) => sum + (point.x - xMean) ** 2,
    0
  );
  const slopePerDay = denominator === 0 ? 0 : numerator / denominator;

  return {
    observations: ordered.length,
    first: round(ordered[0]!.value),
    latest: round(ordered.at(-1)!.value),
    change: round(ordered.at(-1)!.value - ordered[0]!.value),
    slopePerWeek: round(slopePerDay * 7, 3)
  };
}

export class RunningTrendService {
  constructor(
    private readonly workoutService: WorkoutService,
    private readonly workoutAnalysisService: WorkoutAnalysisService
  ) {}

  async getRunningEfficiencyTrends() {
    const workouts = (await this.workoutService.list(500, 'running')).sort(
      (a, b) => workoutTimestamp(a) - workoutTimestamp(b)
    );
    const nowMs = Date.now();
    const last90 = workouts.filter(
      (workout) => nowMs - workoutTimestamp(workout) <= 90 * 86_400_000
    );

    const pairs: WorkoutAnalysisPair[] = [];
    for (const workout of last90) {
      pairs.push({
        workout,
        analysis: await this.workoutAnalysisService.analyse(workout.id)
      });
    }

    const buildWindow = (days: number) => {
      const windowPairs = pairs.filter(
        ({ workout }) => nowMs - workoutTimestamp(workout) <= days * 86_400_000
      );
      const windowWorkouts = windowPairs.map(({ workout }) => workout);
      const totalDistanceM = windowWorkouts.reduce(
        (sum, workout) => sum + (workout.distance_m ?? 0),
        0
      );
      const totalDurationSeconds = windowWorkouts.reduce(
        (sum, workout) => sum + (workout.duration_seconds ?? 0),
        0
      );
      const weightedPace =
        totalDistanceM > 0 && totalDurationSeconds > 0
          ? (totalDurationSeconds / totalDistanceM) * 1000
          : null;
      const efficiencies = windowPairs
        .map(({ analysis }) => analysis.aerobicEfficiencyMetersPerHeartbeat)
        .filter((value): value is number => value !== null);
      const drifts = windowPairs
        .map(({ analysis }) => analysis.heartRateDrift.aerobicDecouplingPercent)
        .filter((value): value is number => value !== null);
      const paceConsistency = windowPairs
        .map(({ analysis }) => analysis.consistency.paceCoefficientOfVariation)
        .filter((value): value is number => value !== null);
      const heartRateConsistency = windowPairs
        .map(({ analysis }) => analysis.consistency.heartRateCoefficientOfVariation)
        .filter((value): value is number => value !== null);

      const paceAt = (targetBpm: number) => {
        const values = windowPairs
          .map(({ workout, analysis }) => {
            const pace = analysis.hrPaceBands.find(
              (band) => band.targetBpm === targetBpm
            )?.paceSecondsPerKm;
            return pace !== null && pace !== undefined
              ? { timestampMs: workoutTimestamp(workout), value: pace }
              : null;
          })
          .filter((value): value is DatedValue => value !== null);
        return linearTrend(values);
      };

      const heartRateAtComparableSpeeds = new Map<number, DatedValue[]>();
      for (const { workout, analysis } of windowPairs) {
        for (const bucket of analysis.heartRateBySpeed) {
          const existing = heartRateAtComparableSpeeds.get(bucket.speedMps) ?? [];
          existing.push({
            timestampMs: workoutTimestamp(workout),
            value: bucket.avgHeartRateBpm
          });
          heartRateAtComparableSpeeds.set(bucket.speedMps, existing);
        }
      }

      const heartRateAtSpeedTrend = [...heartRateAtComparableSpeeds.entries()]
        .map(([speedMps, values]) => ({
          speedMps,
          paceSecondsPerKm: round(1000 / speedMps),
          trend: linearTrend(values)
        }))
        .filter((item) => item.trend !== null)
        .sort((a, b) => a.speedMps - b.speedMps);

      const fastestKilometrePair = windowPairs
        .filter(
          ({ analysis }) =>
            analysis.fastestKilometre?.paceSecondsPerKm !== null &&
            analysis.fastestKilometre !== null
        )
        .sort(
          (a, b) =>
            (a.analysis.fastestKilometre?.paceSecondsPerKm ??
              Number.POSITIVE_INFINITY) -
            (b.analysis.fastestKilometre?.paceSecondsPerKm ??
              Number.POSITIVE_INFINITY)
        )[0];
      const distancePb = [...windowWorkouts].sort(
        (a, b) => (b.distance_m ?? 0) - (a.distance_m ?? 0)
      )[0];
      const averagePacePb = windowWorkouts
        .filter(
          (workout) =>
            (workout.distance_m ?? 0) >= 1000 && workout.avg_pace_seconds_per_km !== null
        )
        .sort(
          (a, b) =>
            (a.avg_pace_seconds_per_km ?? Number.POSITIVE_INFINITY) -
            (b.avg_pace_seconds_per_km ?? Number.POSITIVE_INFINITY)
        )[0];

      return {
        days,
        workoutCount: windowWorkouts.length,
        totalDistanceM: round(totalDistanceM),
        averagePaceSecondsPerKm: weightedPace !== null ? round(weightedPace) : null,
        aerobicEfficiencyMetersPerHeartbeat: (() => {
          const value = average(efficiencies);
          return value !== null ? round(value, 4) : null;
        })(),
        averageAerobicDecouplingPercent: (() => {
          const value = average(drifts);
          return value !== null ? round(value) : null;
        })(),
        consistency: {
          averagePaceCoefficientOfVariation: (() => {
            const value = average(paceConsistency);
            return value !== null ? round(value, 4) : null;
          })(),
          averageHeartRateCoefficientOfVariation: (() => {
            const value = average(heartRateConsistency);
            return value !== null ? round(value, 4) : null;
          })()
        },
        paceAtHeartRateTrend: {
          bpm140: paceAt(140),
          bpm145: paceAt(145),
          bpm150: paceAt(150)
        },
        heartRateAtComparableSpeedTrend: heartRateAtSpeedTrend,
        personalBests: {
          distance: distancePb
            ? {
                workoutId: distancePb.id,
                distanceM: distancePb.distance_m,
                startedAt: distancePb.started_at
              }
            : null,
          averagePace: averagePacePb
            ? {
                workoutId: averagePacePb.id,
                paceSecondsPerKm: averagePacePb.avg_pace_seconds_per_km,
                distanceM: averagePacePb.distance_m,
                startedAt: averagePacePb.started_at
              }
            : null,
          fastestKilometre: fastestKilometrePair
            ? {
                workoutId: fastestKilometrePair.workout.id,
                startedAt: fastestKilometrePair.workout.started_at,
                ...fastestKilometrePair.analysis.fastestKilometre
              }
            : null
        }
      };
    };

    return {
      generatedAt: new Date().toISOString(),
      windows: {
        days7: buildWindow(7),
        days30: buildWindow(30),
        days90: buildWindow(90)
      }
    };
  }
}
