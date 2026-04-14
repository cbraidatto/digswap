---
phase: 029-local-index-folder-scanner
plan: 02
subsystem: desktop-ui
tags: [electron, ipc, react, sqlite, library, scanner]

requires:
  - phase: 029-01
    provides: scanner engine (scanFolder), SQLite database module (db.ts), metadata parser, folder inference
provides:
  - Library IPC handlers (registerLibraryIpc) for folder picker, scan, tracks, root
  - Preload bridge extension with DesktopBridgeLibrary methods
  - LibraryScreen component with 4-state machine (empty, scanning, error-summary, library)
  - LibraryListView flat table component with 6 columns
  - LibraryAlbumView album-grouped component
  - Biblioteca tab in AppShell navigation
affects: [029-03, desktop-sync, desktop-trade]

tech-stack:
  added: []
  patterns: [IPC handler module pattern with sendToMainWindow parameter, state machine UI component]

key-files:
  created:
    - apps/desktop/src/main/library/library-ipc.ts
    - apps/desktop/src/main/library/library-ipc.test.ts
    - apps/desktop/src/renderer/src/LibraryScreen.tsx
    - apps/desktop/src/renderer/src/LibraryListView.tsx
    - apps/desktop/src/renderer/src/LibraryAlbumView.tsx
  modified:
    - apps/desktop/src/main/ipc.ts
    - apps/desktop/src/main/index.ts
    - apps/desktop/src/preload/trade.ts
    - apps/desktop/src/renderer/src/AppShell.tsx

key-decisions:
  - "sendToTradeWindow used for library IPC progress events (library UI lives in trade window renderer, not main window)"

patterns-established:
  - "IPC handler module pattern: registerXxxIpc(sendToWindow) for domain-specific IPC registration"
  - "State machine screen pattern: ScreenState union type with conditional rendering per state"

requirements-completed: [SCAN-01, SCAN-02, SCAN-03, SCAN-04]

duration: 6min
completed: 2026-04-14
---

# Phase 29 Plan 02: Library IPC + UI Summary

**Library IPC handlers wired to 4-state LibraryScreen with flat list and album-grouped views, Biblioteca tab in AppShell**

## Performance

- **Duration:** 6 min
- **Started:** 2026-04-14T19:17:12Z
- **Completed:** 2026-04-14T19:23:37Z
- **Tasks:** 2 of 3 (Task 3 is human-verify checkpoint)
- **Files modified:** 9

## Accomplishments
- Created library-ipc.ts with 6 IPC handlers and 13 passing unit tests
- Extended preload bridge with all 7 DesktopBridgeLibrary methods (selectLibraryFolder, startScan, startIncrementalScan, startFullScan, getLibraryTracks, getLibraryRoot, onScanProgress)
- Built LibraryScreen with complete state machine: empty state with folder picker CTA, scanning progress with bar/ticker/error counter, error summary with dismiss, library results with header and view toggle
- Built LibraryListView with 6-column table (Title, Artist, Album, Format, Bitrate, Duration) with inferred metadata styling
- Built LibraryAlbumView with album-grouped tracks sorted alphabetically ("Album Desconhecido" last)
- Added "Biblioteca" tab to AppShell nav bar between Trades and Settings
- Added closeLibraryDb cleanup on app before-quit

## Task Commits

Each task was committed atomically:

1. **Task 1: Create library IPC handlers with tests, extend preload bridge** - `2153d23` (feat)
2. **Task 2: Build LibraryScreen with all UI states and list/album views** - `14f8592` (feat)
3. **Task 3: Verify full scan flow in desktop app** - checkpoint:human-verify (pending)

## Files Created/Modified
- `apps/desktop/src/main/library/library-ipc.ts` - IPC handlers for all library operations
- `apps/desktop/src/main/library/library-ipc.test.ts` - 13 unit tests covering all IPC handlers
- `apps/desktop/src/main/ipc.ts` - Wires registerLibraryIpc into registerDesktopIpc
- `apps/desktop/src/main/index.ts` - Adds closeLibraryDb on before-quit
- `apps/desktop/src/preload/trade.ts` - Extends bridge with DesktopBridgeLibrary methods
- `apps/desktop/src/renderer/src/LibraryScreen.tsx` - Main library screen with 4 states
- `apps/desktop/src/renderer/src/LibraryListView.tsx` - Flat table view of tracks
- `apps/desktop/src/renderer/src/LibraryAlbumView.tsx` - Album-grouped view of tracks
- `apps/desktop/src/renderer/src/AppShell.tsx` - Added "library" tab and LibraryScreen rendering

## Decisions Made
- Used sendToTradeWindow (not sendToMainWindow) for library IPC events since the library UI lives in the trade window renderer (AppShell.tsx is in renderer/src, served by the trade window)

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None.

## User Setup Required
None - no external service configuration required.

## Known Stubs
None - all components wire to real IPC calls and return real data from SQLite.

## Next Phase Readiness
- Pending human verification of end-to-end scan flow (Task 3 checkpoint)
- After verification, library feature is complete for Phase 29

---
*Phase: 029-local-index-folder-scanner*
*Completed: 2026-04-14 (pending checkpoint)*
