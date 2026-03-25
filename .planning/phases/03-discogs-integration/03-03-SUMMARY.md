---
phase: 03-discogs-integration
plan: 03
subsystem: api
tags: [discogs, import, worker, realtime, broadcast, supabase, webrtc-pattern, self-invocation]

# Dependency graph
requires:
  - phase: 03-discogs-integration/01
    provides: "Discogs types, client factory, OAuth flow, DB schema (import_jobs, releases, collections, wantlist)"
  - phase: 03-discogs-integration/02
    provides: "OAuth callback route that creates import jobs and triggers the worker"
provides:
  - "processImportPage() - processes one page of Discogs collection (100 items)"
  - "processWantlistPage() - processes one page of Discogs wantlist"
  - "broadcastProgress() - Supabase Realtime Broadcast REST API helper"
  - "POST /api/discogs/import - API route orchestrating page-by-page import pipeline"
  - "Self-invocation pattern for processing large collections within Vercel timeout limits"
  - "Collection-to-wantlist automatic transition (D-07)"
affects: [03-discogs-integration/04, 03-discogs-integration/05, 03-discogs-integration/06]

# Tech tracking
tech-stack:
  added: []
  patterns: ["Self-invocation API route for background processing", "Supabase Realtime Broadcast REST API from server-side", "Admin client for all worker DB operations (RLS bypass)", "Select-then-insert duplicate prevention pattern"]

key-files:
  created:
    - src/lib/discogs/broadcast.ts
    - src/lib/discogs/import-worker.ts
    - src/app/api/discogs/import/route.ts
  modified: []

key-decisions:
  - "Admin client for all worker DB operations -- consistency and RLS bypass for releases table"
  - "Select-then-insert for collection_items deduplication (no unique constraint on user_id + discogs_instance_id)"
  - "MAX_PAGES=200 safety limit prevents runaway imports (20,000+ items)"
  - "Re-fetch job after completion for accurate processed/total counts in broadcast"

patterns-established:
  - "Self-invocation pattern: API route processes one page, then fire-and-forget fetches itself for next page"
  - "IMPORT_WORKER_SECRET Bearer token for internal-only API route authentication"
  - "Non-fatal broadcast: progress display errors do not block import processing"

requirements-completed: [DISC-02, DISC-03, DISC-04]

# Metrics
duration: 14min
completed: 2026-03-25
---

# Phase 03 Plan 03: Import Pipeline Summary

**Background import worker with self-invocation pattern: processes Discogs collection/wantlist pages, upserts releases via admin client, broadcasts Realtime progress, and auto-chains collection-to-wantlist on completion**

## Performance

- **Duration:** 14 min
- **Started:** 2026-03-25T17:38:03Z
- **Completed:** 2026-03-25T17:52:13Z
- **Tasks:** 2
- **Files modified:** 3

## Accomplishments
- Broadcast helper sends progress events via Supabase Realtime Broadcast REST API (server-side, no WebSocket)
- Import worker processes collection and wantlist pages with release upserts, item creation, progress tracking, error handling, and MAX_PAGES safety limit
- API route orchestrates page-by-page processing with self-invocation, handles collection-to-wantlist transition (D-07), authenticates via shared secret, and updates lastSyncedAt on completion

## Task Commits

Each task was committed atomically:

1. **Task 1: Broadcast helper and import worker core logic** - `8191ba7` (feat)
2. **Task 2: Import API route with self-invocation chain and wantlist transition** - `80a7b59` (feat)

## Files Created/Modified
- `src/lib/discogs/broadcast.ts` - Supabase Realtime Broadcast REST API helper for progress events
- `src/lib/discogs/import-worker.ts` - Core import logic: processImportPage and processWantlistPage with release upsert, item creation, progress update, error handling
- `src/app/api/discogs/import/route.ts` - API route orchestrating the import pipeline via self-invocation pattern

## Decisions Made
- Used admin client (`createAdminClient()`) for ALL worker database operations -- releases table requires `supabaseAuthAdminRole`, and using one client for all operations provides consistency
- Implemented select-then-insert pattern for collection_items deduplication since no unique constraint exists on (user_id, discogs_instance_id)
- Set MAX_PAGES=200 as safety limit (prevents processing more than 20,000 items)
- Re-fetch job row after marking completed to get accurate processed/total counts for the completion broadcast
- Wantlist items deduplicated by (user_id, release_id) since wantlist has no instance_id equivalent

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None

## User Setup Required

The import pipeline requires `IMPORT_WORKER_SECRET` environment variable to be set. This should be a strong random string used as a Bearer token for internal API route authentication. This was already referenced in the 03-02 callback route, so it should already be documented in prior setup instructions.

## Next Phase Readiness
- Import pipeline is fully wired: callback route (03-02) creates job and triggers this worker
- Worker processes pages, broadcasts progress, and auto-chains wantlist after collection
- Ready for Plan 04 (import progress UI) to consume Realtime events
- Ready for Plan 05 (manual sync / disconnect) to create sync jobs

## Self-Check: PASSED

- [x] src/lib/discogs/broadcast.ts exists
- [x] src/lib/discogs/import-worker.ts exists
- [x] src/app/api/discogs/import/route.ts exists
- [x] Commit 8191ba7 exists
- [x] Commit 80a7b59 exists
- [x] No stubs found

---
*Phase: 03-discogs-integration*
*Completed: 2026-03-25*
