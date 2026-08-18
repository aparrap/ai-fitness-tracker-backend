import type { Json } from '../../types/database.types.js';
import type { WeightService } from '../../modules/weights/weight.service.js';
import type { WorkoutService } from '../../modules/workouts/workout.service.js';
import type { WorkoutMetricRepository } from '../../modules/workout-metrics/workout-metric.repository.js';
import type { WorkoutSourceRepository } from '../../modules/workout-sources/workout-source.repository.js';
import type { WorkoutSplitService } from '../../modules/workout-splits/workout-split.service.js';
import type { WorkoutAnalysisService } from '../../modules/fitness-analytics/workout-analysis.service.js';
import type { WorkoutCoachingService } from '../../modules/coaching/workout-coaching.service.js';
import type { CoachingSyncResult } from '../../modules/coaching/coaching.types.js';
import type {
  DataSyncRepository,
  SyncCounts
} from '../../modules/syncs/data-sync.repository.js';
import type { AppleHealthImportInput } from './apple-health.schema.js';
import {
  normalizeAppleHealthWeight,
  normalizeAppleHealthWorkout,
  normalizeAppleHealthWorkoutSamples
} from './apple-health.normalizer.js';

const MAX_COACHING_PER_SYNC = 3;
const COACHING_RECENCY_MS = 48 * 60 * 60 * 1000;

type CoachingCandidate = {
  workout: Awaited<ReturnType<WorkoutService['getById']>>;
  sourceRecordId: string;
  endedAtMs: number;
  analysis: unknown;
};

export type AppleHealthImportResult = SyncCounts & {
  syncId: string;
  status: 'completed';
  replayed: boolean;
  coaching: CoachingSyncResult[];
};

export class AppleHealthImportService {
  constructor(
    private readonly weightService: WeightService,
    private readonly workoutService: WorkoutService,
    private readonly metricRepository: WorkoutMetricRepository,
    private readonly workoutSourceRepository: WorkoutSourceRepository,
    private readonly syncRepository: DataSyncRepository,
    private readonly splitService?: WorkoutSplitService,
    private readonly workoutAnalysisService?: WorkoutAnalysisService,
    private readonly coachingService?: WorkoutCoachingService
  ) {}

  async import(input: AppleHealthImportInput): Promise<AppleHealthImportResult> {
    const existing = await this.syncRepository.find('apple_health', input.syncId);

    if (existing?.status === 'completed') {
      return {
        syncId: input.syncId,
        status: 'completed',
        replayed: true,
        weightsProcessed: existing.weights_processed,
        workoutsProcessed: existing.workouts_processed,
        workoutsMatched: existing.workouts_matched,
        workoutsDeleted: existing.workouts_deleted,
        metricSamplesProcessed: existing.metric_samples_processed,
        coaching: await this.loadReplayCoaching(input)
      };
    }

    const sync = await this.syncRepository.start(
      'apple_health',
      input.syncId,
      input.device ? (input.device as unknown as Json) : null
    );

    const counts: SyncCounts = {
      weightsProcessed: 0,
      workoutsProcessed: 0,
      workoutsMatched: 0,
      workoutsDeleted: 0,
      metricSamplesProcessed: 0
    };
    const coachingCandidates: CoachingCandidate[] = [];

    try {
      // Apply deletions first. If the same HealthKit UUID is also present in this batch,
      // the subsequent workout import restores it and becomes authoritative.
      for (const sourceRecordId of new Set(input.deletedWorkoutSourceRecordIds)) {
        const linkedWorkoutId = await this.workoutSourceRepository.findWorkoutId(
          'apple_health',
          sourceRecordId
        );
        if (linkedWorkoutId && (await this.workoutService.softDelete(linkedWorkoutId))) {
          counts.workoutsDeleted += 1;
        }
      }

      for (const weightPayload of input.weights) {
        await this.weightService.create(
          normalizeAppleHealthWeight(weightPayload),
          {
            ingestedVia: 'apple_health_import',
            rawPayload: weightPayload as unknown as Json
          }
        );

        counts.weightsProcessed += 1;
      }

      for (const workoutPayload of input.workouts) {
        const {
          heartRateSamples: _legacyHeartRateSamples,
          samples: _samples,
          ...workoutRawPayload
        } = workoutPayload;
        const normalized = normalizeAppleHealthWorkout(workoutPayload);
        const workoutSamples = normalizeAppleHealthWorkoutSamples(workoutPayload);

        const linkedWorkoutId = await this.workoutSourceRepository.findWorkoutId(
          'apple_health',
          workoutPayload.sourceRecordId
        );

        let workout;

        if (linkedWorkoutId) {
          workout = await this.workoutService.enrichExisting(
            linkedWorkoutId,
            normalized
          );
          counts.workoutsMatched += 1;
        } else {
          const likelyDuplicate =
            await this.workoutService.findLikelyDuplicate(normalized);

          if (likelyDuplicate) {
            workout = await this.workoutService.enrichExisting(
              likelyDuplicate.id,
              normalized
            );
            counts.workoutsMatched += 1;
          } else {
            workout = await this.workoutService.create(normalized, {
              ingestedVia: 'apple_health_import',
              rawPayload: workoutRawPayload as unknown as Json
            });
          }

          await this.workoutSourceRepository.link({
            workoutId: workout.id,
            sourceProvider: 'apple_health',
            sourceRecordId: workoutPayload.sourceRecordId,
            rawPayload: workoutRawPayload as unknown as Json
          });
        }

        counts.workoutsProcessed += 1;

        counts.metricSamplesProcessed +=
          await this.metricRepository.upsertAppleHealthSamples(
            workout.id,
            workoutPayload.startedAt,
            workoutSamples
          );

        if (
          this.splitService &&
          workoutSamples.some((sample) =>
            ['heart_rate', 'distance', 'running_speed'].includes(sample.metric)
          )
        ) {
          await this.splitService.recalculateKilometreSplits(workout.id);
        }

        let analysis: unknown = null;
        if (this.workoutAnalysisService) {
          analysis = await this.workoutAnalysisService.recalculateSnapshot(workout.id);
        }

        const endedAtMs = new Date(workoutPayload.endedAt).getTime();
        const ageMs = Date.now() - endedAtMs;
        if (
          this.coachingService &&
          analysis !== null &&
          ageMs >= -5 * 60 * 1000 &&
          ageMs <= COACHING_RECENCY_MS
        ) {
          coachingCandidates.push({
            workout,
            sourceRecordId: workoutPayload.sourceRecordId,
            endedAtMs,
            analysis
          });
        }
      }

      const coaching = await Promise.all(
        coachingCandidates
          .sort((left, right) => right.endedAtMs - left.endedAtMs)
          .slice(0, MAX_COACHING_PER_SYNC)
          .map(async (candidate): Promise<CoachingSyncResult> => {
            try {
              return await this.coachingService!.evaluate(candidate);
            } catch {
              return {
                workoutId: candidate.workout.id,
                sourceRecordId: candidate.sourceRecordId,
                status: 'failed'
              };
            }
          })
      );

      await this.syncRepository.complete(sync.id, counts);

      return {
        syncId: input.syncId,
        status: 'completed',
        replayed: false,
        ...counts,
        coaching
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown import error';

      try {
        await this.syncRepository.fail(sync.id, message);
      } catch {
        // Preserve the original import error if writing the failure state also fails.
      }

      throw error;
    }
  }

  private async loadReplayCoaching(
    input: AppleHealthImportInput
  ): Promise<CoachingSyncResult[]> {
    if (!this.coachingService || input.workouts.length === 0) return [];

    const results = await Promise.all(
      input.workouts.map(async (workoutPayload): Promise<CoachingSyncResult | null> => {
        const workoutId = await this.workoutSourceRepository.findWorkoutId(
          'apple_health',
          workoutPayload.sourceRecordId
        );
        if (!workoutId) return null;

        const persisted = await this.coachingService!.getLatest(workoutId);
        if (!persisted?.summary) return null;

        return {
          workoutId,
          sourceRecordId: workoutPayload.sourceRecordId,
          status: 'completed',
          summary: persisted.summary
        };
      })
    );

    return results.filter((result): result is CoachingSyncResult => result !== null);
  }
}
