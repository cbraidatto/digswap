---
phase: 030-sync-engine
plan: 01
subsystem: sync-engine
tags: [sync, dedup, api, schema, pg_cron]
dependency_graph:
  requires: [Phase 29 desktop library scanner, existing releases/collections schema]
  provides: [POST /api/desktop/library/sync, processSyncBatch, normalizeForDedup, makeAlbumKey, deletedAt column, pg_cron purge]
  affects: [collection_items schema, desktop sync flow, public profile visibility]
tech_stack:
  added: [zod (route validation)]
  patterns: [TDD red-green, normalized dedup matching, soft-delete with grace period, batch upsert]
key_files:
  created:
    - apps/web/src/lib/sync/normalize.ts
    - apps/web/src/lib/sync/normalize.test.ts
    - apps/web/src/lib/sync/process-sync-batch.ts
    - apps/web/src/lib/sync/process-sync-batch.test.ts
    - apps/web/src/app/api/desktop/library/sync/route.ts
    - supabase/migrations/030_purge_soft_deleted.sql
  modified:
    - apps/web/src/lib/db/schema/collections.ts
    - apps/web/vitest.config.ts
decisions:
  - "Removed audioFormat/bitrate/sampleRate from collection item upsert -- columns do not exist in current schema"
  - "Added uniqueIndex on (userId, releaseId) to Drizzle schema to match existing DB constraint for upsert conflict resolution"
  - "Added src/lib/**/*.test.ts to vitest include pattern for co-located test files"
metrics:
  duration: 7min
  completed: 2026-04-15
  tasks: 2
  files: 8
---

# Phase 030 Plan 01: Sync Engine Server Infrastructure Summary

Server-side sync API with normalized dedup matching, batch upsert, soft-delete lifecycle, and pg_cron purge for desktop library sync

## What Was Built

### Task 1: Schema Migration + Normalization Functions
- Added `deletedAt` timestamp column to `collectionItems` table with partial index on non-null values
- Added `uniqueIndex` on `(userId, releaseId)` to Drizzle schema (matches existing DB constraint)
- Created `normalizeForDedup()`: lowercases, strips leading articles (The/A/An), removes punctuation, collapses whitespace
- Created `makeAlbumKey()`: combines normalized artist + album with `::` separator for dedup key
- 12 unit tests covering null, articles, punctuation, whitespace, mixed case edge cases
- Added `src/lib/**/*.test.ts` to vitest include pattern for co-located test files

### Task 2: Batch Processor + API Route + pg_cron Purge
- `processSyncBatch()`: groups tracks by album key, queries for existing releases (preferring Discogs matches), creates local-only releases for unmatched albums, upserts collection items, soft-deletes for removed files, returns releaseMappings
- `POST /api/desktop/library/sync`: Bearer auth (admin.auth.getUser), Zod validation (max 100 tracks, max 200 deletedReleaseIds), rate limiting (fail-open), delegates to batch processor
- pg_cron migration: daily 3AM UTC purge of collection items with `deletedAt` older than 7 days
- 6 unit tests: Discogs linking, local release creation, soft-delete, album sharing, releaseMappings, dedupQueued counter

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Removed audioFormat/bitrate/sampleRate from collection item upsert**
- **Found during:** Task 2
- **Issue:** Plan specified audioFormat, bitrate, sampleRate fields on collection items but these columns do not exist in the current schema
- **Fix:** Removed these fields from insert/upsert values -- collection items store release-level metadata, not per-track audio specs
- **Files modified:** apps/web/src/lib/sync/process-sync-batch.ts

**2. [Rule 3 - Blocking] Added uniqueIndex to Drizzle schema for upsert conflict target**
- **Found during:** Task 2
- **Issue:** `onConflictDoUpdate` on `(userId, releaseId)` requires Drizzle to know about the unique constraint, but it only existed as a DB migration
- **Fix:** Added `uniqueIndex("collection_items_user_release_unique")` to Drizzle schema to match existing DB constraint
- **Files modified:** apps/web/src/lib/db/schema/collections.ts

## Commits

| Task | Commit | Description |
|------|--------|-------------|
| 1 | e84154a | Schema deletedAt column + normalization functions with TDD tests |
| 2 | 7819696 | Batch processor, sync API route, pg_cron purge migration |

## Known Stubs

None -- all functions are fully implemented with real logic and proper error handling.

## Verification

- 18/18 tests passing (12 normalize + 6 batch processor)
- Zero TypeScript errors in sync files
- Migration file exists at supabase/migrations/030_purge_soft_deleted.sql
- SyncResponse type includes releaseMappings: ReleaseMapping[]
