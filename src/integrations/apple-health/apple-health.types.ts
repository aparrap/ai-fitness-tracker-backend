/**
 * Apple HealthKit is read on an Apple device, not directly by this Node server.
 * A future iOS companion app/shortcut/exporter should normalize HealthKit records
 * into this transport shape and POST them to the backend.
 */
export type AppleHealthWorkoutPayload = {
  sourceRecordId: string;
  activityType: string;
  startedAt: string;
  endedAt: string;
  distanceM?: number;
  activeEnergyKcal?: number;
  avgHeartRateBpm?: number;
  maxHeartRateBpm?: number;
};

export type AppleHealthWeightPayload = {
  sourceRecordId: string;
  measuredAt: string;
  weightKg: number;
  heightCm?: number;
};
