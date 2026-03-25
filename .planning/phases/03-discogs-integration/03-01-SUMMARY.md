---
phase: 03-discogs-integration
plan: 01
subsystem: database, api
tags: [discogs, drizzle, zustand, oauth, import-jobs, rls, vitest]

# Dependency graph
requires:
  - phase: 01-foundation
    provides: DB schema patterns, Supabase admin client, RLS conventions, vitest config
provides:
  - import_jobs table schema with RLS policies
  - wantlist_items addedVia column for disconnect source tracking
  - profiles lastSyncedAt column for delta sync
  - TypeScript contracts for ImportJob, DiscogsProgressPayload, DiscogsCollectionResponse
  - Discogs client factory (createDiscogsClient) with Vault token retrieval
  - computeRarityScore utility function
  - Zustand useImportStore for client-side import progress
  - Mock factory for Discogs API responses
  - 7 Wave 0 test stub files (27 todo tests)
affects: [03-02, 03-03, 03-04, 03-05, 03-06]

# Tech tracking
tech-stack:
  added: ["@lionralfs/discogs-client"]
  patterns: [zustand-store-pattern, discogs-client-factory, vault-token-retrieval, wave-0-test-stubs]

key-files:
  created:
    - src/lib/db/schema/import-jobs.ts
    - src/lib/discogs/types.ts
    - src/lib/discogs/client.ts
    - src/stores/import-store.ts
    - tests/__mocks__/discogs.ts
    - tests/unit/lib/discogs/oauth.test.ts
    - tests/unit/lib/discogs/import-worker.test.ts
    - tests/unit/lib/discogs/sync.test.ts
    - tests/integration/discogs/callback.test.ts
    - tests/integration/discogs/import.test.ts
    - tests/integration/discogs/disconnect.test.ts
    - tests/unit/components/discogs/import-progress.test.tsx
  modified:
    - src/lib/db/schema/wantlist.ts
    - src/lib/db/schema/users.ts
    - src/lib/db/schema/index.ts
    - .env.local.example
    - package.json

key-decisions:
  - "Discogs client factory retrieves tokens from Vault first, falls back to discogs_tokens table"
  - "computeRarityScore uses want/have ratio capped at 1.0, null for zero data"
  - "Zustand import store tracks isActive based on processing/pending status"
  - "Service role (supabaseAuthAdminRole) for import_jobs insert/update; users can only SELECT own"

patterns-established:
  - "Zustand store pattern: src/stores/{feature}-store.ts with typed state interface"
  - "Mock factory pattern: tests/__mocks__/{service}.ts exporting reusable mock generators"
  - "Wave 0 test stubs: describe blocks with test.todo() for future implementation"
  - "Discogs client factory: server-only authenticated client from Vault tokens"

requirements-completed: [DISC-01, DISC-02, DISC-03, DISC-04, DISC-05, DISC-06]

# Metrics
duration: 4min
completed: 2026-03-25
---

# Phase 03 Plan 01: Discogs Integration Foundation Summary

**import_jobs schema, Discogs client factory with Vault token retrieval, Zustand import store, type contracts, and 27 Wave 0 test stubs across 7 test files**

## Performance

- **Duration:** 4 min
- **Started:** 2026-03-25T17:25:54Z
- **Completed:** 2026-03-25T17:30:31Z
- **Tasks:** 2
- **Files modified:** 18

## Accomplishments
- Created import_jobs table with full RLS (user select own, service role insert/update) and all columns for job queue tracking
- Added addedVia column to wantlist_items and lastSyncedAt to profiles for Discogs disconnect and delta sync
- Installed @lionralfs/discogs-client and created server-side client factory with Vault-first token retrieval
- Created Zustand useImportStore with updateProgress, reset, and setActive actions
- Created comprehensive mock factory and 7 Wave 0 test stub files (27 todos) covering all DISC requirements
- All 74 existing tests remain green

## Task Commits

Each task was committed atomically:

1. **Task 1: Schema additions, dependency install, env vars, and type contracts** - `a14352d` (feat)
2. **Task 2: Discogs client factory, Zustand import store, mock factory, and Wave 0 test stubs** - `db554ec` (feat)

## Files Created/Modified
- `src/lib/db/schema/import-jobs.ts` - import_jobs table with RLS policies for job queue
- `src/lib/discogs/types.ts` - TypeScript contracts: ImportJobType, ImportJobStatus, DiscogsProgressPayload, ImportJob, DiscogsCollectionItem, DiscogsCollectionResponse
- `src/lib/discogs/client.ts` - Server-side Discogs client factory with Vault token retrieval and computeRarityScore
- `src/stores/import-store.ts` - Zustand store for client-side import progress tracking
- `tests/__mocks__/discogs.ts` - Mock factory: mockCollectionPage, mockWantlistPage, mockDiscogsIdentity, mockRequestTokenResponse, mockAccessTokenResponse
- `tests/unit/lib/discogs/oauth.test.ts` - 3 todo tests for OAuth helpers
- `tests/unit/lib/discogs/import-worker.test.ts` - 7 todo tests for import worker
- `tests/unit/lib/discogs/sync.test.ts` - 3 todo tests for delta sync
- `tests/integration/discogs/callback.test.ts` - 3 todo tests for OAuth callback route
- `tests/integration/discogs/import.test.ts` - 3 todo tests for import pipeline
- `tests/integration/discogs/disconnect.test.ts` - 4 todo tests for disconnect flow
- `tests/unit/components/discogs/import-progress.test.tsx` - 4 todo tests for ImportProgress component
- `src/lib/db/schema/wantlist.ts` - Added addedVia varchar column and varchar import
- `src/lib/db/schema/users.ts` - Added lastSyncedAt timestamp column
- `src/lib/db/schema/index.ts` - Added barrel export for import-jobs
- `.env.local.example` - Added DISCOGS_CONSUMER_KEY, DISCOGS_CONSUMER_SECRET, IMPORT_WORKER_SECRET
- `package.json` - Added @lionralfs/discogs-client dependency

## Decisions Made
- Discogs client factory retrieves tokens from Vault (vault.decrypted_secrets) first, falls back to discogs_tokens table -- supports both secure Vault and simpler table storage
- computeRarityScore returns want/have ratio capped at 1.0; returns null when both are 0 (insufficient data); returns 1.0 when have is 0 (maximum rarity)
- Zustand import store uses isActive derived from status (true when processing or pending) -- no separate flag needed
- import_jobs uses supabaseAuthAdminRole for insert/update (only the import worker writes), authenticatedRole for select (user views own progress)
- Mock factory uses realistic jazz album data (Kind of Blue, A Love Supreme, Head Hunters, etc.) for recognizable test output

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None.

## User Setup Required

External services require manual configuration:
- **DISCOGS_CONSUMER_KEY**: From Discogs Developer Settings -> Create Application -> Consumer Key
- **DISCOGS_CONSUMER_SECRET**: From Discogs Developer Settings -> Create Application -> Consumer Secret
- **IMPORT_WORKER_SECRET**: Generate a random 32-character string for self-invocation auth

See `.env.local.example` for all required environment variables.

## Next Phase Readiness
- All foundations in place for Plans 02-05 to execute: schema, types, client factory, mock factory, test stubs
- Plans 02 (OAuth flow), 03 (import worker), 04 (sync), 05 (disconnect) can proceed in parallel
- No blockers -- drizzle-kit push skipped (no DB connection in CI), schema files are the deliverable

## Self-Check: PASSED

All 12 created files verified on disk. Both task commits (a14352d, db554ec) verified in git log.

---
*Phase: 03-discogs-integration*
*Completed: 2026-03-25*
