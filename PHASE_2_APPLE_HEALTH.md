# Phase 2 — Apple Health Ingestion

This phase connects a real iPhone HealthKit store to the hosted Fastify API.

## What Phase 2 adds

Backend:
- `POST /api/v1/import/apple-health`
- `GET /api/v1/import/apple-health/status`
- `GET /api/v1/workouts/:id/metrics?metric=heart_rate`
- batch-level idempotency through `data_syncs`
- record-level idempotency through Apple Health UUIDs
- canonical workout/source linking to prevent Apple Health + adidas duplicates
- high-resolution heart-rate samples
- 15 MB Fastify request body limit for HealthKit batches
- constant-time comparison of the ingest secret
- production `tsconfig.build.json`

Database:
- `workout_source_links`
- `data_syncs`
- `source_record_id` on `workout_metric_samples`

iPhone:
- HealthKit read authorization
- workout import
- associated HR sample import
- optional weight import (disabled by default)
- 90-day first sync, then incremental sync with a 5-minute overlap

## Deployment order

### 1. Run the Phase 2 database migration

In Supabase SQL Editor run:

`supabase/migrations/202608140002_apple_health_ingestion.sql`

Do this before deploying the new backend code.

Then regenerate DB types later with:

```bash
pnpm db:types
```

The repository already contains starter types including the Phase 2 schema, so type generation
does not block the first deploy.

### 2. Generate the Apple Health ingest key

On your Mac:

```bash
openssl rand -hex 32
```

This returns 64 hexadecimal characters.

Treat this as a secret.

### 3. Add the new Render environment variable

In Render -> `ai-fitness-tracker-backend-0a0k` -> Environment:

```text
APPLE_HEALTH_INGEST_API_KEY=<the 64-character value>
```

Do not put the value in GitHub.

### 4. Deploy backend v0.2.0

Copy/merge the updated project into your Git repository, then:

```bash
pnpm install
pnpm test
pnpm typecheck
pnpm build

git add .
git commit -m "Add Apple Health ingestion"
git push
```

Render should auto-deploy from your linked branch.

After deploy:

```bash
curl https://ai-fitness-tracker-backend-0a0k.onrender.com/health
```

Expected:

```json
{
  "status": "ok",
  "service": "ai-fitness-tracker-backend",
  "version": "0.2.0"
}
```

## Test the importer before building the iOS app

Keep the ingest key in an environment variable in your terminal:

```bash
export APPLE_HEALTH_INGEST_API_KEY='YOUR_64_CHAR_KEY'
```

Run:

```bash
curl -X POST \
  https://ai-fitness-tracker-backend-0a0k.onrender.com/api/v1/import/apple-health \
  -H "content-type: application/json" \
  -H "x-ingest-key: ${APPLE_HEALTH_INGEST_API_KEY}" \
  --data @examples/apple-health-import.json
```

Expected response shape:

```json
{
  "syncId": "iphone-...",
  "status": "completed",
  "replayed": false,
  "weightsProcessed": 1,
  "workoutsProcessed": 1,
  "workoutsMatched": 0,
  "metricSamplesProcessed": 2
}
```

Running the exact same request again returns `replayed: true` rather than creating a
second copy.

Check sync status:

```bash
curl \
  "https://ai-fitness-tracker-backend-0a0k.onrender.com/api/v1/import/apple-health/status?limit=10" \
  -H "x-ingest-key: ${APPLE_HEALTH_INGEST_API_KEY}"
```

## Cross-source deduplication

The existing database contains historical workouts seeded with source
`adidas_running`.

If the same workout later arrives from Apple Health, the importer searches for a
canonical workout on the same local date and activity type.

A candidate is considered compatible when available values are within:

- duration: 180 seconds
- distance: 350 metres

If matched, the importer:
1. keeps the existing workout row;
2. enriches it with exact start time, HR and other Apple values;
3. adds an Apple Health source link;
4. attaches HR samples to that canonical workout.

This prevents stats from counting the same run twice.

`workoutsMatched` in the sync response tells you how many imported workouts reused
existing canonical rows.

## iPhone Health Bridge

The folder:

`clients/ios-health-bridge`

contains the Swift source kit.

### Create the Xcode project

1. Xcode -> File -> New -> Project.
2. iOS -> App.
3. Product Name: `AIFitnessHealthBridge`.
4. Interface: SwiftUI.
5. Language: Swift.
6. Use iOS 17+ as the deployment target.
7. Copy these files from the source kit into the app target:
   - `AIFitnessHealthBridgeApp.swift`
   - `ContentView.swift`
   - `HealthSyncViewModel.swift`
   - `HealthKitManager.swift`
   - `BackendClient.swift`
   - `Models.swift`
8. Copy `Config.swift.example` to `Config.swift`.
9. Put the same Render ingest key in `Config.swift`.
10. Ensure `Config.swift` is not committed.

### Enable HealthKit

Target -> Signing & Capabilities -> `+ Capability` -> HealthKit.

Add this Info.plist privacy key:

```text
Privacy - Health Share Usage Description
```

Suggested text:

```text
AI Fitness Tracker reads your workouts, heart rate and weight to sync them to your private fitness database.
```

The bridge is read-only.

### Weight syncing

`Config.swift.example` has:

```swift
static let syncWeights = false
```

Leave this false initially because your historical weights are already canonical in
Supabase. This phase focuses on workout + HR ingestion.

We can enable Apple Health weight syncing later after adding canonical measurement
source links similar to workout source links.

### First iPhone sync

Run the app on your physical iPhone.

Tap:

`Sync Apple Health`

The first run reads the last 90 days of workouts. This is intentional so the importer
can match your historical adidas/ChatGPT runs and enrich those rows with exact start
times and HealthKit HR samples.

Subsequent runs only fetch data since the last successful sync, with a five-minute
overlap. UUID-based idempotency makes the overlap safe.

## Verify in Supabase

Run:

`supabase/verify_apple_health.sql`

You should see:
- the latest sync as `completed`;
- Apple Health links attached to workouts;
- HR sample counts for synced workouts.

## Read a workout HR curve through the API

First get workouts:

```bash
curl "https://ai-fitness-tracker-backend-0a0k.onrender.com/api/v1/workouts?activityType=running"
```

Copy a workout UUID, then:

```bash
curl \
  "https://ai-fitness-tracker-backend-0a0k.onrender.com/api/v1/workouts/WORKOUT_UUID/metrics?metric=heart_rate&limit=5000"
```

The result is an ordered HR time series containing:
- `sampled_at`
- `elapsed_seconds`
- `value`
- `unit`

That is the raw input we will use for the next analytics phase:
heart-rate drift, HR/pace efficiency, training zones, recovery behavior and eventually
OpenAI-generated fitness analysis.

## Authentication note

`x-ingest-key` is intentionally a simple single-user MVP mechanism. It is suitable for
a personal iPhone app that you control.

Before supporting additional users or distributing the app, migrate the iOS client to
Supabase Auth and derive `profile_id` from an authenticated user rather than from a
server configuration value.
