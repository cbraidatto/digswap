---
phase: 030-sync-engine
plan: 02
subsystem: desktop
tags: [electron, sqlite, sync, ipc, better-sqlite3, incremental-sync]

# Dependency graph
requires:
  - phase: 029-library-index
    provides: SQLite schema with tracks table, syncedAt/syncHash columns, TrackRow interface
provides:
  - SyncManager: startSync function with batch loop, deletion detection, release mapping storage
  - SQLite helpers: getUnsyncedTracks, markTracksSynced, getIndexedFilePaths, setReleaseMappings, getReleaseMappingsForPaths
  - release_mappings SQLite table for tracking web-side release UUIDs
  - IPC handler desktop:start-sync and desktop:sync-progress event
  - SyncResult and SyncProgress types in ipc-types.ts
affects: [030-sync-engine, 031-file-watcher, desktop-renderer]

# Tech tracking
tech-stack:
  added: []
  patterns: [mocked-db-tests-for-electron-native-modules, batch-sync-with-deletion-detection]

key-files:
  created:
    - apps/desktop/src/main/library/sync-manager.ts
    - apps/desktop/src/main/library/sync-manager.test.ts
  modified:
    - apps/desktop/src/main/library/db.ts
    - apps/desktop/src/main/library/library-ipc.ts
    - apps/desktop/src/shared/ipc-types.ts
    - apps/desktop/src/main/ipc.ts

key-decisions:
  - "Mock db.ts functions in tests instead of in-memory SQLite due to better-sqlite3 native module compiled for Electron Node version"
  - "Batch size 75 tracks per request (tuned within 50-100 range per D-02)"
  - "deletedReleaseIds sent only with first batch to avoid duplicate deletion requests"
  - "registerLibraryIpc parameters made optional to maintain backward compatibility"

patterns-established:
  - "Sync manager pattern: detect unsynced, group by album, batch HTTP, mark synced, store mappings"
  - "Deletion detection: fs.existsSync on indexed paths, release_mappings lookup for web-side IDs"

requirements-completed: [SYNC-01, SYNC-03, SYNC-04]

# Metrics
duration: 8min
completed: 2026-04-14
---

# Phase 030 Plan 02: Desktop Sync Manager Summary

**Incremental sync manager with batch HTTP, filesystem deletion detection via release_mappings lookup, and IPC trigger from renderer**

## Performance

- **Duration:** 8 min
- **Started:** 2026-04-15T01:39:36Z
- **Completed:** 2026-04-15T01:47:50Z
- **Tasks:** 2
- **Files modified:** 6

## Accomplishments
- Desktop sync manager queries unsynced tracks (syncedAt IS NULL OR < modifiedAt), groups by album, sends max-75-track batches with Bearer auth
- Deleted files detected via fs.existsSync on indexed paths; release IDs looked up via release_mappings SQLite table and sent as deletedReleaseIds
- Server-returned releaseMappings stored in SQLite after each successful batch for future deletion lookups
- IPC handler desktop:start-sync registered, threading auth and siteUrl from main process runtime

## Task Commits

Each task was committed atomically:

1. **Task 1: Sync manager with SQLite helpers, deletion detection, and release mapping storage**
   - `d9758f4` (test: add failing tests for sync manager logic) [TDD RED]
   - `f22dc3e` (feat: implement sync manager with SQLite helpers and deletion detection) [TDD GREEN]
2. **Task 2: Register sync IPC handler and update bridge types** - `61ce5dd` (feat)

## Files Created/Modified
- `apps/desktop/src/main/library/sync-manager.ts` - Core sync loop: startSync, groupTracksByAlbum, buildTrackPayload
- `apps/desktop/src/main/library/sync-manager.test.ts` - 10 unit tests covering all sync behaviors
- `apps/desktop/src/main/library/db.ts` - Added release_mappings table, getUnsyncedTracks, markTracksSynced, getIndexedFilePaths, setReleaseMappings, getReleaseMappingsForPaths, makeLocalAlbumKey
- `apps/desktop/src/main/library/library-ipc.ts` - Added desktop:start-sync handler with auth and progress forwarding
- `apps/desktop/src/shared/ipc-types.ts` - Added SyncResult, SyncProgress interfaces; startSync and onSyncProgress to DesktopBridgeLibrary
- `apps/desktop/src/main/ipc.ts` - Updated registerLibraryIpc call to pass authRuntime and siteUrl

## Decisions Made
- Mocked db.ts functions in tests instead of using in-memory better-sqlite3, because the native module is compiled for Electron's Node version (NODE_MODULE_VERSION 145) which differs from the system Node (137)
- Batch size set to 75 tracks per request (within the 50-100 range specified in D-02)
- deletedReleaseIds sent only with the first batch to avoid sending duplicate deletion requests across multiple batches
- registerLibraryIpc parameters (getAuth, getSiteUrl) made optional with ? to maintain backward compatibility with existing callers

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
- better-sqlite3 native module compiled for Electron's Node version (v145) cannot be used in vitest running on system Node (v137). Resolved by mocking db.ts functions instead of using in-memory SQLite directly in tests.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Sync manager ready to be triggered from desktop renderer UI
- Web API endpoint (Plan 01) needed to receive the batched sync requests
- Plan 03 (deletion/purge) builds on the deletedReleaseIds sent by this manager

---
*Phase: 030-sync-engine*
*Completed: 2026-04-14*
