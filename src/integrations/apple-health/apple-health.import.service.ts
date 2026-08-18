import type { Json } from '../../types/database.types.js';
import type { WeightService } from '../../modules/weights/weight.service.js';
import type { WorkoutService } from '../../modules/workouts/workout.service.js';
import type { WorkoutMetricRepository } from '../../modules/workout-metrics/workout-metric.repository.js';
import type { WorkoutSourceRepository } from '../../modules/workout-sources/workout-source.repository.js';
import type { WorkoutSplitService } from '../../modules/workout-splits/workout-split.service.js';
import type { WorkoutAnalysisService } from '../../modules/fitness-analytics/workout-analysis.service.js';
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

export type AppleHealthImportResult = SyncCounts & {
  syncId: string;
  status: 'completed';
  replayed: boolean;
};

export class AppleHealthImportService {
  constructor(
    private readonly weightService: WeightService,
    private readonly workoutService: WorkoutService,
    private readonly metricRepository: WorkoutMetricRepository,
    private readonly workoutSourceRepository: WorkoutSourceRepository,
    private readonly syncRepository: DataSyncRepository,
    private readonly splitService?: WorkoutSplitService,
    private readonly workoutAnalysisService?: WorkoutAnalysisService
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
        metricSamplesProcessed: existing.metric_samples_processed
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
      metricSamplesProcessed: 0
    };

    try {
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

        // Persist deterministic calculated metrics after sample/split changes. Trend reads
        // can then aggregate compact snapshots instead of rescanning raw HealthKit series.
        if (this.workoutAnalysisService) {
          await this.workoutAnalysisService.recalculateSnapshot(workout.id);
        }
      }

      await this.syncRepository.complete(sync.id, counts);

      return {
        syncId: input.syncId,
        status: 'completed',
        replayed: false,
        ...counts
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
}
