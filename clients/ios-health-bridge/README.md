# AI Fitness Health Bridge (iOS source kit)

This is the iPhone-side source for Phase 2.

It reads Apple Health with HealthKit and POSTs normalized data to:

`https://ai-fitness-tracker-backend-0a0k.onrender.com/api/v1/import/apple-health`

## Why an iOS app is required

Apple Health / HealthKit data is stored and permissioned on Apple devices. The Render
Node backend cannot query the HealthKit store directly. The phone reads the data and
sends it to your backend.

## Create the Xcode project

1. Open Xcode.
2. File -> New -> Project -> iOS -> App.
3. Product Name: `AIFitnessHealthBridge`
4. Interface: SwiftUI
5. Language: Swift
6. Minimum target: iOS 17 or newer is recommended.
7. Create the project.
8. Copy these Swift files into the app target:
   - `AIFitnessHealthBridgeApp.swift`
   - `ContentView.swift`
   - `HealthSyncViewModel.swift`
   - `HealthKitManager.swift`
   - `BackendClient.swift`
   - `Models.swift`
9. Copy `Config.swift.example` to `Config.swift`, replace the ingest key, and add
   `Config.swift` to the Xcode target.

## Enable HealthKit

In the app target:

1. Signing & Capabilities
2. `+ Capability`
3. Add `HealthKit`

Add this Info.plist privacy entry:

- `Privacy - Health Share Usage Description`
- Value: `AI Fitness Tracker reads your workouts, heart rate and weight to sync them to your private fitness database.`

The bridge is read-only, so it does not request permission to write Health data.

## Configure the ingest key

Generate the key:

```bash
openssl rand -hex 32
```

Use the same 64-character value in two places:

1. Render -> your backend -> Environment:
   `APPLE_HEALTH_INGEST_API_KEY`
2. `Config.swift`:
   `AppConfig.ingestAPIKey`

Do not commit `Config.swift`.

## First run

Run on a real iPhone. HealthKit is device-specific; use your physical phone for the
real integration.

Tap `Sync Apple Health`.

The first sync reads the last 90 days. Later syncs use the previous successful sync
timestamp with a five-minute overlap. All server records are idempotent, so the overlap
does not create duplicates.

## Data synced

- Body mass / weight
- Workouts
- workout duration
- walking/running distance when available
- active energy when available
- high-resolution heart-rate samples associated with each workout

The backend derives average and max HR from samples when necessary.

## Current authentication model

The source kit uses `x-ingest-key` for a single-user personal MVP.

This is acceptable for a private app installed only on your device, but the key is
compiled into the app binary. Before distributing the app or supporting multiple
users, replace this with Supabase Auth and a user JWT.
