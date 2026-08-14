/**
 * Port for a future adidas Running integration.
 *
 * Keep the external provider behind this interface so the rest of the app
 * does not depend on adidas-specific authentication or payloads.
 *
 * The public backend does not assume undocumented endpoints.
 */
export type ExternalRunningWorkout = {
  externalId: string;
  startedAt: string;
  durationSeconds?: number;
  distanceM?: number;
  activeEnergyKcal?: number;
  avgHeartRateBpm?: number;
  maxHeartRateBpm?: number;
  avgPaceSecondsPerKm?: number;
};

export interface AdidasRunningAdapter {
  listWorkouts(since?: Date): Promise<ExternalRunningWorkout[]>;
}
