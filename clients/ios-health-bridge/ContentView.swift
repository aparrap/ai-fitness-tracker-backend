import SwiftUI

struct ContentView: View {
    @StateObject private var viewModel = HealthSyncViewModel()

    var body: some View {
        NavigationStack {
            VStack(spacing: 24) {
                Image(systemName: "heart.text.square.fill")
                    .font(.system(size: 72))
                    .foregroundStyle(.red)

                Text("AI Fitness Health Bridge")
                    .font(.title2.bold())

                Text(viewModel.status)
                    .multilineTextAlignment(.center)
                    .foregroundStyle(.secondary)

                Button {
                    Task {
                        await viewModel.sync()
                    }
                } label: {
                    if viewModel.isSyncing {
                        ProgressView()
                            .frame(maxWidth: .infinity)
                    } else {
                        Text("Sync Apple Health")
                            .frame(maxWidth: .infinity)
                    }
                }
                .buttonStyle(.borderedProminent)
                .disabled(viewModel.isSyncing)

                Spacer()
            }
            .padding()
            .navigationTitle("Health Sync")
        }
    }
}

#Preview {
    ContentView()
}
