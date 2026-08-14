# AI Fitness Tracker Backend

Node.js + TypeScript backend for a personal fitness data platform backed by Supabase/PostgreSQL.

## Stack

- Node.js 24 LTS
- TypeScript
- Fastify
- Supabase PostgreSQL + `@supabase/supabase-js`
- Zod runtime validation
- Vitest tests
- pnpm
- Apple Health adapter boundary
- adidas Running adapter boundary
- OpenAI analysis port prepared for a later phase

## Architecture

```text
Apple Health iOS bridge ─┐
                         │
adidas Running adapter ──┼──> Fastify API ──> services ──> repositories ──> Supabase/PostgreSQL
                         │
Manual API input ────────┘

Supabase/PostgreSQL ──> future FitnessAnalysisProvider ──> OpenAI Responses API
```

The source integrations are adapters. They normalize external data into the same internal workout/weight models.

## Important Apple Health constraint

HealthKit data lives in the HealthKit store on iPhone/Apple Watch and is accessed by an Apple app with user permission. The Node backend therefore does not "pull HealthKit" directly. A later small iOS companion app, Shortcut/export process, or other Apple-side bridge will read HealthKit and send normalized payloads to this API.

## Important Supabase key rule

The backend uses `SUPABASE_SECRET_KEY`, a server-only `sb_secret_...` key.

Do not expose it to:
- a browser bundle
- an iOS application
- GitHub
- logs
- Slack

The key bypasses Row Level Security. In this single-user MVP, every repository query is also scoped to the configured `FITNESS_PROFILE_ID`.

When a real frontend/mobile app is added, add Supabase Auth and derive the profile from the authenticated user instead of trusting a profile ID from the request.

## 1. Requirements

```bash
node --version
# v24.x

corepack enable
corepack prepare pnpm@latest --activate

pnpm --version
```

Install the Supabase CLI separately if you want local migrations/type generation.

## 2. Install

```bash
pnpm install
```

## 3. Configure environment

```bash
cp .env.example .env
```

Fill in:

```dotenv
SUPABASE_URL=https://YOUR_PROJECT.supabase.co
SUPABASE_SECRET_KEY=sb_secret_...
FITNESS_PROFILE_ID=8d553210-69a8-4f25-91be-000000000001
```

In Supabase Dashboard:
1. Project Settings / API Keys.
2. Create/copy a Secret key for this backend.
3. Never use the secret key in frontend code.

## 4. Seed reconciliation

Your earlier seed was incomplete.

Run:

```text
supabase/seed.sql
```

in the Supabase SQL Editor.

It is idempotent because each imported row uses the unique key:

```text
(profile_id, source_provider, source_record_id)
```

Then run:

```text
supabase/verify_seed.sql
```

A complete database returns zero `missing_or_mismatched_*` rows.

## 5. Start API

```bash
pnpm dev
```

Health check:

```bash
curl http://localhost:3000/health
```

Expected:

```json
{
  "status": "ok",
  "service": "ai-fitness-tracker-backend"
}
```

## 6. API

### GET /api/v1/weights

```bash
curl "http://localhost:3000/api/v1/weights?limit=20"
```

### POST /api/v1/weights

```bash
curl -X POST http://localhost:3000/api/v1/weights \
  -H "content-type: application/json" \
  -d '{
    "measuredOn": "2026-08-15",
    "weightKg": 102.4,
    "heightCm": 175,
    "sourceProvider": "manual",
    "notes": "Morning measurement"
  }'
```

### GET /api/v1/workouts

```bash
curl "http://localhost:3000/api/v1/workouts?activityType=running&limit=20"
```

### POST /api/v1/workouts

```bash
curl -X POST http://localhost:3000/api/v1/workouts \
  -H "content-type: application/json" \
  -d '{
    "activityType": "running",
    "startedOn": "2026-08-15",
    "durationSeconds": 2300,
    "distanceM": 5300,
    "activeEnergyKcal": 590,
    "avgHeartRateBpm": 150,
    "sourceProvider": "manual"
  }'
```

If pace is omitted, the service derives elapsed pace from duration and distance.

### GET /api/v1/workouts/:id

Returns one workout belonging to the configured profile.

### GET /api/v1/stats/summary

Returns:
- latest weight
- change from previous weight
- run count
- total run distance
- total run time
- mean stored pace
- mean average-HR

## 7. Generate database types from Supabase

The repository contains a compatible starter `database.types.ts`, so it can be opened immediately.

After linking the Supabase CLI to the project, replace it with generated types:

```bash
supabase login
supabase link --project-ref YOUR_PROJECT_REF
pnpm db:types
pnpm typecheck
```

Repeat type generation whenever the database schema changes.

## 8. Test

```bash
pnpm test
pnpm typecheck
pnpm format:check
```

## 9. Project structure

```text
ai-fitness-tracker-backend/
├── src/
│   ├── app.ts
│   ├── server.ts
│   ├── config/
│   │   └── env.ts
│   ├── lib/
│   │   └── supabase.ts
│   ├── shared/
│   │   ├── date.ts
│   │   └── errors.ts
│   ├── types/
│   │   └── database.types.ts
│   ├── modules/
│   │   ├── weights/
│   │   │   ├── weight.schema.ts
│   │   │   ├── weight.repository.ts
│   │   │   ├── weight.service.ts
│   │   │   └── weight.routes.ts
│   │   ├── workouts/
│   │   │   ├── workout.schema.ts
│   │   │   ├── workout.repository.ts
│   │   │   ├── workout.service.ts
│   │   │   └── workout.routes.ts
│   │   ├── stats/
│   │   │   ├── stats.service.ts
│   │   │   └── stats.routes.ts
│   │   └── analysis/
│   │       └── analysis.port.ts
│   └── integrations/
│       ├── apple-health/
│       │   ├── apple-health.types.ts
│       │   └── apple-health.normalizer.ts
│       └── adidas-running/
│           └── adidas-running.adapter.ts
├── tests/
│   ├── stats.service.test.ts
│   └── workout.service.test.ts
├── supabase/
│   ├── migrations/
│   │   └── 202608140001_initial_schema.sql
│   ├── seed.sql
│   └── verify_seed.sql
├── .env.example
├── .gitignore
├── package.json
├── tsconfig.json
├── vitest.config.ts
└── README.md
```

## Layer responsibilities

### Route
HTTP only:
- parse/validate request
- call service
- choose HTTP status

### Service
Business rules:
- derive pace
- normalize identifiers
- calculate summaries
- later coordinate imports/AI

### Repository
Supabase persistence only:
- SELECT
- UPSERT
- profile scoping

### Integration adapter
Provider-specific logic:
- Apple Health normalization
- adidas Running integration
- later retries/cursors/token refresh

### Analysis provider
AI boundary:
- receives already-normalized fitness data
- does not own or mutate raw source records
- analysis results can later be persisted to `ai_analyses`

## Next backend phases

1. Core API + Supabase connection
2. Supabase Auth instead of fixed profile ID
3. Apple Health ingestion endpoint + iOS bridge
4. adidas Running partner/export ingestion
5. high-resolution HR samples in `workout_metric_samples`
6. OpenAI analysis provider using the Responses API
7. scheduled analysis and dashboard/mobile frontend


## Phase 2: Apple Health

Phase 2 is implemented in this repository.

See:

```text
PHASE_2_APPLE_HEALTH.md
```

It adds secure/idempotent HealthKit batch ingestion, source-level workout deduplication,
high-resolution heart-rate samples, sync status, and an iOS SwiftUI source kit under:

```text
clients/ios-health-bridge/
```

The hosted backend target is:

```text
https://ai-fitness-tracker-backend-0a0k.onrender.com
```
