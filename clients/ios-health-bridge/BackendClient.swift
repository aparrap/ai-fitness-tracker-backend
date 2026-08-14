import Foundation

enum BackendClientError: LocalizedError {
    case invalidResponse
    case httpError(status: Int, body: String)

    var errorDescription: String? {
        switch self {
        case .invalidResponse:
            return "The backend returned an invalid response."
        case .httpError(let status, let body):
            return "Backend HTTP \(status): \(body)"
        }
    }
}

final class BackendClient {
    private let session: URLSession
    private let encoder = JSONEncoder()
    private let decoder = JSONDecoder()

    init(session: URLSession = .shared) {
        self.session = session
    }

    func importAppleHealth(
        _ payload: AppleHealthImportPayload
    ) async throws -> ImportResponse {
        let url = AppConfig.backendURL
            .appending(path: "api")
            .appending(path: "v1")
            .appending(path: "import")
            .appending(path: "apple-health")

        var request = URLRequest(url: url)
        request.httpMethod = "POST"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.setValue(AppConfig.ingestAPIKey, forHTTPHeaderField: "x-ingest-key")
        request.timeoutInterval = 120
        request.httpBody = try encoder.encode(payload)

        let (data, response) = try await session.data(for: request)

        guard let httpResponse = response as? HTTPURLResponse else {
            throw BackendClientError.invalidResponse
        }

        guard (200...299).contains(httpResponse.statusCode) else {
            let body = String(data: data, encoding: .utf8) ?? "<no response body>"
            throw BackendClientError.httpError(
                status: httpResponse.statusCode,
                body: body
            )
        }

        return try decoder.decode(ImportResponse.self, from: data)
    }
}
