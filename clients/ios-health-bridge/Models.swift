import Foundation

struct AppleHealthImportPayload: Codable {
    let syncId: String
    let exportedAt: String
    let device: DeviceMetadata
    let weights: [WeightPayload]
    let workouts: [WorkoutPayload]
}

struct DeviceMetadata: Codable {
    let name: String?
    let model: String?
    let systemVersion: String?
    let appVersion: String?
}

struct WeightPayload: Codable {
    let sourceRecordId: String
    let measuredAt: String
    let measuredOn: String
    let weightKg: Double
    let heightCm: Double?
}

struct WorkoutPayload: Codable {
    let sourceRecordId: String
    let activityType: String
    let title: String?
    let startedAt: String
    let startedOn: String
    let endedAt: String
    let durationSeconds: Int?
    let distanceM: Double?
    let activeEnergyKcal: Double?
    let elevationGainM: Double?
    let avgHeartRateBpm: Double?
    let maxHeartRateBpm: Double?
    let heartRateSamples: [HeartRateSamplePayload]
}

struct HeartRateSamplePayload: Codable {
    let sourceRecordId: String
    let sampledAt: String
    let bpm: Double
}

struct ImportResponse: Codable {
    let syncId: String
    let status: String
    let replayed: Bool
    let weightsProcessed: Int
    let workoutsProcessed: Int
    let workoutsMatched: Int
    let metricSamplesProcessed: Int
}

enum ISO8601 {
    static let formatter: ISO8601DateFormatter = {
        let formatter = ISO8601DateFormatter()
        formatter.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        return formatter
    }()

    static let fallbackFormatter: ISO8601DateFormatter = {
        let formatter = ISO8601DateFormatter()
        formatter.formatOptions = [.withInternetDateTime]
        return formatter
    }()

    static func string(from date: Date) -> String {
        formatter.string(from: date)
    }
}


enum LocalDate {
    static let formatter: DateFormatter = {
        let formatter = DateFormatter()
        formatter.calendar = Calendar(identifier: .gregorian)
        formatter.locale = Locale(identifier: "en_US_POSIX")
        formatter.timeZone = .current
        formatter.dateFormat = "yyyy-MM-dd"
        return formatter
    }()

    static func string(from date: Date) -> String {
        formatter.string(from: date)
    }
}
