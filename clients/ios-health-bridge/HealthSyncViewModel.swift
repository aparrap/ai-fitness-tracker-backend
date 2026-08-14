import Foundation

@MainActor
final class HealthSyncViewModel: ObservableObject {
    @Published var status = "Ready to sync"
    @Published var isSyncing = false

    private let healthKit = HealthKitManager()
    private let backend = BackendClient()

    private let lastSuccessfulSyncKey = "lastSuccessfulAppleHealthSync"

    func sync() async {
        guard !isSyncing else { return }

        isSyncing = true
        status = "Requesting Apple Health permission…"

        defer { isSyncing = false }

        do {
            try await healthKit.requestAuthorization()

            let since = syncStartDate()
            status = "Reading Apple Health…"

            let payload = try await healthKit.makeImportPayload(since: since)

            status = "Uploading \(payload.workouts.count) workouts and \(payload.weights.count) weights…"
            let result = try await backend.importAppleHealth(payload)

            UserDefaults.standard.set(Date(), forKey: lastSuccessfulSyncKey)

            status = """
            Sync complete
            Workouts: \(result.workoutsProcessed)
            Weights: \(result.weightsProcessed)
            HR samples: \(result.metricSamplesProcessed)
            """
        } catch {
            status = "Sync failed: \(error.localizedDescription)"
        }
    }

    private func syncStartDate() -> Date {
        if let lastSync = UserDefaults.standard.object(
            forKey: lastSuccessfulSyncKey
        ) as? Date {
            // Deliberate overlap makes retries and late-written HealthKit samples safe.
            return lastSync.addingTimeInterval(-5 * 60)
        }

        // First sync imports a useful historical window without sending an
        // entire lifetime of HealthKit data.
        return Calendar.current.date(
            byAdding: .day,
            value: -90,
            to: Date()
        ) ?? Date().addingTimeInterval(-90 * 24 * 60 * 60)
    }
}
