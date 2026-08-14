import Foundation
import HealthKit
import UIKit

enum HealthKitBridgeError: LocalizedError {
    case unavailable
    case missingType(String)
    case invalidSamples

    var errorDescription: String? {
        switch self {
        case .unavailable:
            return "Health data is not available on this device."
        case .missingType(let name):
            return "HealthKit type is unavailable: \(name)"
        case .invalidSamples:
            return "HealthKit returned unexpected sample data."
        }
    }
}

final class HealthKitManager {
    private let store = HKHealthStore()

    private var heartRateType: HKQuantityType {
        get throws {
            guard let type = HKQuantityType.quantityType(forIdentifier: .heartRate) else {
                throw HealthKitBridgeError.missingType("heartRate")
            }
            return type
        }
    }

    private var bodyMassType: HKQuantityType {
        get throws {
            guard let type = HKQuantityType.quantityType(forIdentifier: .bodyMass) else {
                throw HealthKitBridgeError.missingType("bodyMass")
            }
            return type
        }
    }

    private var activeEnergyType: HKQuantityType {
        get throws {
            guard let type = HKQuantityType.quantityType(forIdentifier: .activeEnergyBurned) else {
                throw HealthKitBridgeError.missingType("activeEnergyBurned")
            }
            return type
        }
    }

    private var runningDistanceType: HKQuantityType {
        get throws {
            guard let type = HKQuantityType.quantityType(forIdentifier: .distanceWalkingRunning) else {
                throw HealthKitBridgeError.missingType("distanceWalkingRunning")
            }
            return type
        }
    }

    func requestAuthorization() async throws {
        guard HKHealthStore.isHealthDataAvailable() else {
            throw HealthKitBridgeError.unavailable
        }

        let readTypes: Set<HKObjectType> = [
            HKObjectType.workoutType(),
            try heartRateType,
            try bodyMassType,
            try activeEnergyType,
            try runningDistanceType
        ]

        try await store.requestAuthorization(toShare: [], read: readTypes)
    }

    func makeImportPayload(since: Date) async throws -> AppleHealthImportPayload {
        async let fetchedWorkouts = fetchWorkouts(since: since)
        let fetchedWeights = AppConfig.syncWeights
            ? try await fetchWeights(since: since)
            : []
        let workouts = try await fetchedWorkouts

        return AppleHealthImportPayload(
            syncId: UUID().uuidString,
            exportedAt: ISO8601.string(from: Date()),
            device: DeviceMetadata(
                name: UIDevice.current.name,
                model: UIDevice.current.model,
                systemVersion: UIDevice.current.systemVersion,
                appVersion: Bundle.main.infoDictionary?["CFBundleShortVersionString"] as? String
            ),
            weights: fetchedWeights,
            workouts: workouts
        )
    }

    private func fetchWeights(since: Date) async throws -> [WeightPayload] {
        let type = try bodyMassType
        let predicate = HKQuery.predicateForSamples(
            withStart: since,
            end: nil,
            options: .strictStartDate
        )
        let sort = NSSortDescriptor(key: HKSampleSortIdentifierStartDate, ascending: true)

        let samples: [HKQuantitySample] = try await querySamples(
            sampleType: type,
            predicate: predicate,
            sortDescriptors: [sort]
        )

        let kgUnit = HKUnit.gramUnit(with: .kilo)

        return samples.map { sample in
            WeightPayload(
                sourceRecordId: sample.uuid.uuidString,
                measuredAt: ISO8601.string(from: sample.startDate),
                measuredOn: LocalDate.string(from: sample.startDate),
                weightKg: sample.quantity.doubleValue(for: kgUnit),
                heightCm: 175
            )
        }
    }

    private func fetchWorkouts(since: Date) async throws -> [WorkoutPayload] {
        let predicate = HKQuery.predicateForSamples(
            withStart: since,
            end: nil,
            options: .strictStartDate
        )
        let sort = NSSortDescriptor(key: HKSampleSortIdentifierStartDate, ascending: true)

        let workouts: [HKWorkout] = try await querySamples(
            sampleType: HKObjectType.workoutType(),
            predicate: predicate,
            sortDescriptors: [sort]
        )

        var payloads: [WorkoutPayload] = []
        payloads.reserveCapacity(workouts.count)

        for workout in workouts {
            let heartRates = try await fetchHeartRateSamples(for: workout)
            let heartRateValues = heartRates.map(\.bpm)

            let averageHeartRate = heartRateValues.isEmpty
                ? nil
                : heartRateValues.reduce(0, +) / Double(heartRateValues.count)

            let maxHeartRate = heartRateValues.max()

            let distance = try runningDistance(for: workout)
            let energy = try activeEnergy(for: workout)

            payloads.append(
                WorkoutPayload(
                    sourceRecordId: workout.uuid.uuidString,
                    activityType: activityName(workout.workoutActivityType),
                    title: activityTitle(workout.workoutActivityType),
                    startedAt: ISO8601.string(from: workout.startDate),
                    startedOn: LocalDate.string(from: workout.startDate),
                    endedAt: ISO8601.string(from: workout.endDate),
                    durationSeconds: Int(workout.duration.rounded()),
                    distanceM: distance,
                    activeEnergyKcal: energy,
                    elevationGainM: nil,
                    avgHeartRateBpm: averageHeartRate,
                    maxHeartRateBpm: maxHeartRate,
                    heartRateSamples: heartRates
                )
            )
        }

        return payloads
    }

    private func fetchHeartRateSamples(
        for workout: HKWorkout
    ) async throws -> [HeartRateSamplePayload] {
        let type = try heartRateType
        let predicate = HKQuery.predicateForObjects(from: workout)
        let sort = NSSortDescriptor(key: HKSampleSortIdentifierStartDate, ascending: true)

        let samples: [HKQuantitySample] = try await querySamples(
            sampleType: type,
            predicate: predicate,
            sortDescriptors: [sort]
        )

        let unit = HKUnit.count().unitDivided(by: .minute())

        return samples.map { sample in
            HeartRateSamplePayload(
                sourceRecordId: sample.uuid.uuidString,
                sampledAt: ISO8601.string(from: sample.startDate),
                bpm: sample.quantity.doubleValue(for: unit)
            )
        }
    }

    private func runningDistance(for workout: HKWorkout) throws -> Double? {
        let type = try runningDistanceType
        return workout
            .statistics(for: type)?
            .sumQuantity()?
            .doubleValue(for: .meter())
    }

    private func activeEnergy(for workout: HKWorkout) throws -> Double? {
        let type = try activeEnergyType
        return workout
            .statistics(for: type)?
            .sumQuantity()?
            .doubleValue(for: .kilocalorie())
    }

    private func activityName(_ activity: HKWorkoutActivityType) -> String {
        switch activity {
        case .running:
            return "running"
        case .walking:
            return "walking"
        case .boxing:
            return "boxing"
        case .traditionalStrengthTraining:
            return "strength_training"
        case .functionalStrengthTraining:
            return "functional_strength_training"
        case .cycling:
            return "cycling"
        case .hiking:
            return "hiking"
        default:
            return "other"
        }
    }

    private func activityTitle(_ activity: HKWorkoutActivityType) -> String {
        switch activity {
        case .running:
            return "Apple Health Run"
        case .walking:
            return "Apple Health Walk"
        case .boxing:
            return "Apple Health Boxing"
        case .traditionalStrengthTraining:
            return "Apple Health Strength Training"
        case .functionalStrengthTraining:
            return "Apple Health Functional Strength Training"
        case .cycling:
            return "Apple Health Cycling"
        case .hiking:
            return "Apple Health Hike"
        default:
            return "Apple Health Workout"
        }
    }

    private func querySamples<T: HKSample>(
        sampleType: HKSampleType,
        predicate: NSPredicate?,
        sortDescriptors: [NSSortDescriptor]
    ) async throws -> [T] {
        try await withCheckedThrowingContinuation { continuation in
            let query = HKSampleQuery(
                sampleType: sampleType,
                predicate: predicate,
                limit: HKObjectQueryNoLimit,
                sortDescriptors: sortDescriptors
            ) { _, samples, error in
                if let error {
                    continuation.resume(throwing: error)
                    return
                }

                guard let typedSamples = samples as? [T] else {
                    continuation.resume(throwing: HealthKitBridgeError.invalidSamples)
                    return
                }

                continuation.resume(returning: typedSamples)
            }

            store.execute(query)
        }
    }
}
