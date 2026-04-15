---
phase: 031-tray-daemon-file-watcher
plan: 01
subsystem: desktop
tags: [electron, tray, system-tray, close-to-tray, auto-start, ipc, daemon]

# Dependency graph
requires:
  - phase: 17-desktop-trade-runtime
    provides: Electron shell, IPC bridge, window management, session store
provides:
  - System tray integration with Open/Quit context menu
  - Close-to-tray window lifecycle (app persists in background)
  - Boot-to-tray mode via --boot-to-tray CLI arg
  - Auto-start IPC using built-in app.setLoginItemSettings
  - DesktopSettings.autoStart persistent setting
  - setAutoStart/getAutoStart on DesktopMainShellBridge
affects: [031-02-file-watcher, desktop-settings-ui]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Module-level tray ref to prevent GC (let tray: Tray | null = null)"
    - "isQuitting flag gating close-to-tray vs real quit behavior"
    - "Built-in app.setLoginItemSettings over electron-auto-launch dependency"

key-files:
  created:
    - apps/desktop/src/main/tray.ts
    - apps/desktop/resources/tray-icon.png
  modified:
    - apps/desktop/src/main/window.ts
    - apps/desktop/src/main/index.ts
    - apps/desktop/src/main/ipc.ts
    - apps/desktop/src/shared/ipc-types.ts
    - apps/desktop/src/main/session-store.ts
    - apps/desktop/src/preload/main.ts

key-decisions:
  - "Used app.setLoginItemSettings instead of electron-auto-launch per Discretion clause -- no extra dep, native args support, auto registry cleanup"
  - "Tray context menu has exactly Open and Quit (no Pause per D-02)"
  - "window-all-closed is intentionally empty -- app persists in tray"
  - "NativeImage type import instead of Electron namespace for tsc compatibility"

patterns-established:
  - "isQuitting flag pattern: set in before-quit, checked in close handler to distinguish tray-hide from real quit"
  - "bootToTray option on createMainWindow: conditionally skip ready-to-show for silent startup"

requirements-completed: [DAEMON-01, DAEMON-02, DAEMON-04, DAEMON-05]

# Metrics
duration: 6min
completed: 2026-04-15
---

# Phase 031 Plan 01: Tray Daemon + Window Lifecycle Summary

**System tray integration with close-to-tray, boot-to-tray, and auto-start IPC using Electron built-in APIs**

## Performance

- **Duration:** 6 min
- **Started:** 2026-04-15T14:00:53Z
- **Completed:** 2026-04-15T14:06:54Z
- **Tasks:** 2
- **Files modified:** 8

## Accomplishments
- Created tray module with Open/Quit context menu and double-click-to-focus handler
- Implemented close-to-tray: clicking window X hides the window, app persists in system tray
- Added boot-to-tray mode: --boot-to-tray CLI arg skips showing window on startup
- Wired auto-start IPC using Electron's built-in app.setLoginItemSettings (no external dependency)
- Extended DesktopMainShellBridge with setAutoStart/getAutoStart for renderer access

## Task Commits

Each task was committed atomically:

1. **Task 1: Create tray module, modify window lifecycle, update types** - `1af419c` (feat)
2. **Task 2: Wire tray into app lifecycle, auto-start IPC, enhance single-instance** - `73d0675` (feat)

## Files Created/Modified
- `apps/desktop/src/main/tray.ts` - Tray creation, context menu (Open/Quit), double-click handler, GC-safe module ref
- `apps/desktop/resources/tray-icon.png` - 32x32 white vinyl record silhouette on transparent background
- `apps/desktop/src/main/window.ts` - Added isQuitting flag, close-to-tray interceptor, bootToTray option
- `apps/desktop/src/main/index.ts` - Tray lifecycle wiring, boot-to-tray detection, empty window-all-closed
- `apps/desktop/src/main/ipc.ts` - Auto-start IPC handlers (set/get) using app.setLoginItemSettings
- `apps/desktop/src/shared/ipc-types.ts` - Added autoStart to DesktopSettings, setAutoStart/getAutoStart to bridge
- `apps/desktop/src/main/session-store.ts` - Added autoStart: false default
- `apps/desktop/src/preload/main.ts` - Exposed setAutoStart/getAutoStart to main shell

## Decisions Made
- Used Electron's built-in `app.setLoginItemSettings()` instead of `electron-auto-launch` (per Discretion clause in CONTEXT.md). Rationale: no extra dependency, better Windows integration, native `args` parameter support for `--boot-to-tray` detection, handles Windows Registry cleanup on uninstall automatically.
- Tray context menu has exactly "Open" and "Quit" -- no "Pause" option (per D-02 decision).
- window-all-closed handler is intentionally empty -- app runs in tray when window is closed/hidden.
- Used `NativeImage` type import instead of `Electron` namespace to avoid tsc namespace resolution issues in environments where electron types are not globally available.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Added .gitignore exception for desktop resources PNG**
- **Found during:** Task 1 (tray icon creation)
- **Issue:** .gitignore has broad `*.png` exclusion that blocked committing tray-icon.png
- **Fix:** Added `!apps/desktop/resources/*.png` exception to .gitignore
- **Files modified:** .gitignore
- **Verification:** git add succeeded after exception added
- **Committed in:** 1af419c (Task 1 commit)

**2. [Rule 1 - Bug] Fixed Electron.NativeImage namespace type reference**
- **Found during:** Task 1 (tray module creation)
- **Issue:** Using `Electron.NativeImage` namespace fails when electron types not globally available
- **Fix:** Used `import { type NativeImage } from "electron"` named type import instead
- **Files modified:** apps/desktop/src/main/tray.ts
- **Verification:** tsc --noEmit shows no new errors in tray.ts (only pre-existing module resolution)
- **Committed in:** 1af419c (Task 1 commit)

---

**Total deviations:** 2 auto-fixed (1 blocking, 1 bug)
**Impact on plan:** Both auto-fixes necessary for correct operation. No scope creep.

## Issues Encountered
- Pre-existing TypeScript errors from missing electron/electron-store/electron-vite module declarations in worktree. No new type errors introduced by this plan's changes.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- Tray foundation complete, app persists in background when window closed
- Ready for Plan 02 (file watcher) which depends on the app running persistently
- Auto-start setting wired but no UI toggle yet (needs settings page update)

---
*Phase: 031-tray-daemon-file-watcher*
*Completed: 2026-04-15*
