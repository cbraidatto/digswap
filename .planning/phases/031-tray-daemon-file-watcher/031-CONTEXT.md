# Phase 31: Tray Daemon + File Watcher - Context

**Gathered:** 2026-04-15
**Status:** Ready for planning

<domain>
## Phase Boundary

Desktop app runs persistently in the background, watching for file changes and keeping the index current. Minimizes to system tray instead of closing, monitors the library folder with chokidar, performs diff scan on startup to reconcile index, and supports auto-start with Windows.

Surfaces in scope:
- Tray icon with context menu (Open, Quit)
- Close button → minimize to tray (always, not configurable)
- chokidar file watcher on library root (recursive, debounced)
- Auto re-scan + auto-sync on file changes
- Diff scan on startup comparing SQLite index vs filesystem
- Auto-start with Windows via electron-auto-launch
- Boot to tray (no window) when auto-started
- Single-instance lock (already exists — enhance with second-instance focus)

Out of scope:
- Multiple library roots (deferred)
- Sync conflict resolution UI (deferred from Phase 30)
- AI metadata enrichment on new files (Phase 32)
- Tray icon status indicator (active/paused visual) — keep simple for v1

</domain>

<decisions>
## Implementation Decisions

### D-01: Tray Behavior — Always Minimize to Tray
- Clicking the window close button (X) ALWAYS minimizes to tray, never quits the app
- This is not configurable — no dialog, no setting. Quit only via tray menu.
- Intercept `close` event on BrowserWindow, call `event.preventDefault()` + `win.hide()`

### D-02: Tray Menu — Minimal (Open + Quit)
- Context menu has exactly 2 items: "Open" (shows/focuses window) and "Quit" (exits app)
- No Pause/Resume watching toggle in tray menu for v1
- No Sync Now button in tray menu for v1
- Double-click on tray icon also opens/focuses the window

### D-03: Watch Strategy — chokidar, Recursive, Debounced 2min
- Use chokidar to watch the library root folder recursively (all subpastas)
- Debounce: 2 minutes after last detected change before triggering re-scan
- On change detected → incremental scan → auto-sync with Supabase (Phase 30 sync engine)
- Monitor only audio extensions matching the Phase 29 scanner list: mp3, flac, wav, ogg, m4a, aac, wma, opus, aiff
- Ignore temp files with hardcoded list: .tmp, .part, .crdownload, thumbs.db, .DS_Store

### D-04: Large Library Warning
- If library folder contains >10K audio files, show a warning to the user
- Warning is informational only — does not block watching
- Message: "Your library has X files. Watching large folders may use more system resources."

### D-05: Auto-Start — electron-auto-launch
- Use the `electron-auto-launch` npm package (cross-platform, handles Windows Registry)
- Setting in desktop settings: "Start with Windows" (default: off)
- When auto-started, boot directly to tray — no window shown
- Window only appears when user clicks "Open" in tray menu

### D-06: Diff Scan on Startup — modifiedAt Comparison with Toast
- On app startup, compare `stat.mtimeMs` of each indexed file vs `modifiedAt` in SQLite
- Detect: new files (exist on disk, not in index), removed files (in index, not on disk), modified files (mtimeMs differs)
- Runs automatically in background — no user confirmation needed
- Shows toast/banner notification with results: "Found 5 new files, 2 removed"
- After diff scan completes, triggers auto-sync if changes were found

### Claude's Discretion
- chokidar configuration details (polling interval, awaitWriteFinish settings)
- Toast/notification UI implementation (Electron notification vs in-app toast)
- Tray icon design (use Electron's nativeImage, appropriate for Windows)
- Whether to use `app.setLoginItemSettings()` vs electron-auto-launch (research both)
- Exact debounce implementation (lodash debounce vs custom timer)

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Desktop Main Process (Phase 31 integration points)
- `apps/desktop/src/main/index.ts` — Main entry, app lifecycle, single-instance lock, window-all-closed handler (MUST MODIFY)
- `apps/desktop/src/main/window.ts` — Window creation, createMainWindow, focusMainWindow (intercept close event here)
- `apps/desktop/src/main/ipc.ts` — IPC registration pattern, registerDesktopIpc
- `apps/desktop/src/main/config.ts` — Desktop configuration pattern

### Desktop Library (Phase 29+30 — direct dependency)
- `apps/desktop/src/main/library/scanner.ts` — scanFolder function, incremental scan mode
- `apps/desktop/src/main/library/db.ts` — SQLite schema, getAllTracks, getLibraryRoot, syncedAt/modifiedAt columns
- `apps/desktop/src/main/library/sync-manager.ts` — startSync function (Phase 30), auto-sync after watch changes
- `apps/desktop/src/main/library/library-ipc.ts` — Library IPC handlers, start-sync, start-scan

### Desktop Settings & Auth
- `apps/desktop/src/main/session-store.ts` — Settings persistence pattern
- `apps/desktop/src/main/supabase-auth.ts` — Auth runtime for sync operations
- `apps/desktop/src/shared/ipc-types.ts` — DesktopSettings interface (add autoStart field)

### Desktop Preload
- `apps/desktop/src/preload/main.ts` — desktopShell bridge (may need new methods)

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `scanFolder(rootPath, onProgress, { incremental: true })` — Incremental scan already built
- `startSync(db, siteUrl, getAccessToken, onProgress)` — Auto-sync after changes
- `getLibraryRoot(db)` — Get configured library path from SQLite
- `app.requestSingleInstanceLock()` — Already in index.ts:26
- `DesktopSettings` interface — Existing settings pattern for auto-start toggle
- `getSettings`/`setSettings` IPC — Already wired for settings persistence

### Established Patterns
- **IPC:** `ipcMain.handle("desktop:channel", handler)` in library-ipc.ts
- **Settings:** `getSettings()`/`setSettings()` pattern in ipc.ts
- **Window management:** `createMainWindow()`, `focusMainWindow()`, `getMainWindow()` in window.ts
- **Lifecycle:** `app.on("window-all-closed", ...)` and `app.on("before-quit", ...)` in index.ts

### Integration Points
- `index.ts` line 161: `window-all-closed` → `app.quit()` — MUST CHANGE to hide instead
- `window.ts`: BrowserWindow close event — intercept with `preventDefault()`
- `DesktopSettings` interface — add `autoStart: boolean` field
- `library-ipc.ts` — watcher start/stop lifecycle tied to library root selection

</code_context>

<specifics>
## Specific Ideas

- chokidar watcher starts when library root is configured, stops when no root is set
- If user changes library root in settings, stop old watcher and start new one
- Tray icon should be visible immediately on app launch (even before window loads)
- The 2-minute debounce means bulk copy operations (e.g., adding 50 albums) settle before scanning
- Diff scan on startup handles the case where user modified files while app was not running

</specifics>

<deferred>
## Deferred Ideas

- **Pause/Resume watching from tray** — Could add toggle later, keep simple for v1
- **Sync Now from tray** — Direct sync trigger without opening window, future enhancement
- **Tray icon status indicator** — Visual feedback (green = watching, yellow = syncing, red = error)
- **Multiple library roots** — Watching multiple folders, deferred from Phase 29
- **macOS/Linux auto-start** — electron-auto-launch supports these but not testing now (Windows-first)

</deferred>

---

*Phase: 031-tray-daemon-file-watcher*
*Context gathered: 2026-04-15*
