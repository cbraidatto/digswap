---
phase: 031-tray-daemon-file-watcher
plan: 02
subsystem: desktop
tags: [electron, chokidar, file-watcher, diff-scan, ipc, library-sync]

# Dependency graph
requires:
  - phase: 031-01
    provides: Tray daemon, close-to-tray, boot-to-tray, auto-start IPC
  - phase: 029-local-index-folder-scanner
    provides: scanner.ts, db.ts, metadata-parser.ts
  - phase: 030-sync-engine
    provides: sync-manager.ts, library-ipc.ts
provides:
  - chokidar file watcher with 2-minute debounce on audio file changes
  - Startup diff scan comparing SQLite index vs filesystem
  - DiffScanResult IPC event for renderer display
  - Auto-sync after watcher detects changes or diff scan finds changes
  - Large library warning for >10K files
  - Native notification for changes when window hidden (boot-to-tray)
  - restartWatching on folder change after user-initiated scan
affects: [desktop-settings-ui, library-ui]

# Tech tracking
tech-stack:
  added:
    - "chokidar@^4.0.3 (file system watching)"
  patterns:
    - "Module-level FSWatcher ref with start/stop/restart lifecycle"
    - "2-minute debounce timer for batching rapid file changes"
    - "awaitWriteFinish for detecting completed file copies"
    - "Batched parallel stat (BATCH_SIZE=50) for diff scan performance"
    - "IIFE async block for background diff scan in whenReady"

key-files:
  created:
    - apps/desktop/src/main/diff-scan.ts
    - apps/desktop/src/main/watcher.ts
  modified:
    - apps/desktop/src/main/index.ts
    - apps/desktop/src/main/library/library-ipc.ts
    - apps/desktop/src/shared/ipc-types.ts
    - apps/desktop/src/preload/main.ts
    - apps/desktop/package.json

key-decisions:
  - "AUDIO_EXTENSIONS matches scanner.ts exactly (.flac, .wav, .aiff) -- D-03 lists 9 extensions but scanner.ts only supports 3 lossless; documented as Phase 29 gap"
  - "stopWatching before closeLibraryDb in before-quit -- prevents scan trigger during shutdown"
  - "restartWatching preserves settledCallback -- no need to re-wire onSettled when folder changes"
  - "readdir with recursive:true cast to string[] -- avoids TS never type from Dirent overload"

patterns-established:
  - "IIFE async in whenReady for background startup tasks that should not block app launch"
  - "Native Notification for boot-to-tray change detection when window not visible"

requirements-completed: [DAEMON-03, SCAN-05]

# Metrics
duration: 5min
completed: 2026-04-15
---

# Phase 031 Plan 02: File Watcher + Diff Scan Summary

**chokidar file watcher with 2-min debounce and startup diff scan for automatic library sync**

## Performance

- **Duration:** 5 min
- **Started:** 2026-04-15T14:11:09Z
- **Completed:** 2026-04-15T14:16:09Z
- **Tasks:** 2
- **Files modified:** 7

## Accomplishments
- Created diff-scan module that compares SQLite index against filesystem on startup
- Created chokidar watcher module with 2-minute debounce for batching rapid changes
- Watcher filters by same audio extensions as scanner (.flac, .wav, .aiff)
- Watcher ignores temp files (.tmp, .part, .crdownload, thumbs.db, .DS_Store)
- Wired watcher and diff scan into app lifecycle (start on ready, stop on quit)
- Diff scan results sent to renderer via desktop:diff-scan-result IPC
- Auto-sync triggered when diff scan finds changes or watcher debounce settles
- Native notification shown for changes when window hidden (boot-to-tray mode)
- Large library warning fires for >10K audio files
- Watcher restarts on new folder after user-initiated scan

## Task Commits

Each task was committed atomically:

1. **Task 1: Create diff-scan module, watcher module, add DiffScanResult type** - `cbde013` (feat)
2. **Task 2: Wire watcher and diff scan into app lifecycle with IPC events** - `b2021f8` (feat)

## Files Created/Modified
- `apps/desktop/src/main/diff-scan.ts` - Startup diff scan with batched parallel stat, returns DiffScanResult
- `apps/desktop/src/main/watcher.ts` - chokidar watcher with 2-min debounce, awaitWriteFinish, start/stop/restart
- `apps/desktop/src/main/index.ts` - Watcher+diff scan lifecycle wiring, stopWatching before closeLibraryDb
- `apps/desktop/src/main/library/library-ipc.ts` - restartWatching after user-initiated scan completes
- `apps/desktop/src/shared/ipc-types.ts` - DiffScanResult interface, onDiffScanResult on bridge
- `apps/desktop/src/preload/main.ts` - onDiffScanResult listener exposed to renderer
- `apps/desktop/package.json` - chokidar@^4.0.3 added to dependencies

## Decisions Made
- AUDIO_EXTENSIONS intentionally matches scanner.ts exactly (.flac, .wav, .aiff) even though D-03 specifies 9 extensions. Watching for mp3/ogg/etc would detect changes the scanner cannot process, causing silent failures. Documented as Phase 29 gap with inline comments.
- stopWatching() called before closeLibraryDb() in before-quit handler to prevent watcher callbacks from trying to access a closed database.
- restartWatching preserves the existing settledCallback set during app init, so no re-wiring needed when the user changes library folder.
- Used `as string[]` cast on readdir result to avoid TypeScript `never` type from the Dirent overload when using `{ recursive: true }`.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
- Pre-existing TypeScript errors from missing type exports in ipc-types.ts (ScanProgressEvent, ScanResult, SyncResult, SyncProgress, LibraryTrack, MetadataConfidence, AudioPrepResult). These are from Phase 29/30 types referenced in consuming files but not yet exported from the shared types file. No new type errors introduced by this plan.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- File watcher and diff scan complete, library changes detected automatically
- Ready for desktop settings UI to show diff scan results and watcher status
- Auto-start + tray daemon + file watcher form complete background daemon functionality

## Self-Check: PASSED

All 7 files verified present. Both commit hashes (cbde013, b2021f8) confirmed in git log.

---
*Phase: 031-tray-daemon-file-watcher*
*Completed: 2026-04-15*
