# Phase 31: Tray Daemon + File Watcher - Research

**Researched:** 2026-04-15
**Domain:** Electron main process — system tray, file watching, auto-start, single-instance
**Confidence:** HIGH

## Summary

This phase adds background persistence to the DigSwap desktop app: minimize-to-tray instead of closing, chokidar file watching on the library folder, diff scan on startup, auto-start with Windows, and single-instance enhancement. All work is in the Electron main process (`apps/desktop/src/main/`) with minimal renderer changes (a new IPC event for diff scan toast results).

The existing codebase provides strong foundations: single-instance lock already exists (line 26 of `index.ts`), incremental scan logic is built (`scanFolder` with `{ incremental: true }`), sync engine is ready (`startSync`), settings persistence via `electron-store` is established, and the IPC pattern is clear. The phase is primarily integration work — wiring existing pieces together with new lifecycle management.

**Primary recommendation:** Use chokidar 4.x (not v5 which is ESM-only), Electron's built-in `app.setLoginItemSettings()` (not `auto-launch` npm package), and Electron's `Tray` + `Menu` APIs. Keep all new code in 3-4 new files under `src/main/`: `tray.ts`, `watcher.ts`, `diff-scan.ts`, and modifications to `index.ts` + `window.ts`.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- D-01: Clicking window close (X) ALWAYS minimizes to tray, never quits. Not configurable. Quit only via tray menu.
- D-02: Tray menu has exactly 2 items: "Open" and "Quit". Double-click on tray icon opens/focuses window.
- D-03: chokidar watches library root recursively, 2-minute debounce after last change, triggers incremental scan then auto-sync. Monitor only: mp3, flac, wav, ogg, m4a, aac, wma, opus, aiff. Ignore: .tmp, .part, .crdownload, thumbs.db, .DS_Store.
- D-04: Large library warning (>10K files) is informational only, does not block watching.
- D-05: Auto-start uses npm package electron-auto-launch. Setting "Start with Windows" default off. Boot to tray when auto-started.
- D-06: Diff scan on startup compares stat.mtimeMs vs modifiedAt in SQLite. Detects new/removed/modified. Shows toast with results. Triggers auto-sync if changes found.

### Claude's Discretion
- chokidar configuration details (polling interval, awaitWriteFinish settings)
- Toast/notification UI (Electron notification vs in-app toast)
- Tray icon design (use Electron nativeImage)
- Whether to use app.setLoginItemSettings() vs electron-auto-launch (research both)
- Exact debounce implementation (lodash debounce vs custom timer)

### Deferred Ideas (OUT OF SCOPE)
- Pause/Resume watching from tray
- Sync Now from tray
- Tray icon status indicator (green/yellow/red)
- Multiple library roots
- macOS/Linux auto-start testing
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| DAEMON-01 | App minimizes to system tray instead of closing when user clicks close button | Intercept BrowserWindow `close` event with `preventDefault()` + `win.hide()`. Remove `window-all-closed` quit on Windows. Tray API keeps app alive. |
| DAEMON-02 | Tray icon shows context menu with options: Open, ~~Pause Watching~~, Quit | CONTEXT.md D-02 overrides REQUIREMENTS.md — menu has only Open + Quit (no Pause). Use `Tray` + `Menu.buildFromTemplate()`. |
| DAEMON-03 | App watches configured folder for file changes using chokidar, auto-updating local index | chokidar 4.x with `ignored` filter for extensions + temp files, `awaitWriteFinish`, 2-min debounce via custom setTimeout. Triggers `scanFolder` incremental + `startSync`. |
| DAEMON-04 | User can enable auto-start with Windows from settings, launching minimized to tray | Use `app.setLoginItemSettings()` with `args: ["--boot-to-tray"]` instead of electron-auto-launch (see research below). Check `process.argv` for `--boot-to-tray` to skip showing window. |
| DAEMON-05 | App enforces single-instance lock — opening second instance focuses existing window | Already exists at `index.ts:26`. Enhance `second-instance` handler to also `win.show()` + `win.focus()` when window is hidden in tray. |
| SCAN-05 | App performs diff scan on startup comparing stored index vs filesystem | New `diff-scan.ts` module using `getIndexedFileMtimes()` + `fs.stat()` comparison. Returns `{ added, removed, modified }` counts. Sends results via IPC for toast display. |
</phase_requirements>

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| chokidar | 4.0.3 | File system watching | Industry standard for Node.js file watching. v4 dropped native deps (no fsevents on Windows), uses `fs.watch` internally. Lighter than v3. v5 is ESM-only which complicates Electron CJS builds — use v4. |
| Electron Tray | Built-in (Electron 41.x) | System tray icon + menu | No external dependency needed. Electron's `Tray` class handles Windows system tray natively. |
| Electron app.setLoginItemSettings | Built-in (Electron 41.x) | Auto-start with Windows | Built-in API, no npm package needed. Adds to Windows Registry startup. Supports `args` parameter for `--boot-to-tray` flag. |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| electron-auto-launch | 5.0.7 | Cross-platform auto-start | CONTEXT.md D-05 specifies this package, BUT Electron's built-in `app.setLoginItemSettings()` is superior for this project: no extra dependency, better Windows integration, supports args parameter. **Recommend built-in API instead** — Claude's discretion area. |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| chokidar 4.x | chokidar 5.x | v5 is ESM-only, requires Node 20+. Electron 41 CJS main process would need import() wrapper. Not worth the complexity. |
| chokidar 4.x | chokidar 3.x | v3 works but has native fsevents dep (unused on Windows but adds install complexity). v4 is lighter. |
| app.setLoginItemSettings | electron-auto-launch | auto-launch wraps registry edits that Electron already handles natively. Extra dependency for no benefit. Built-in API supports `args` for boot-to-tray detection. |
| Custom debounce | lodash.debounce | Adding lodash for one function is wasteful. A 10-line setTimeout wrapper is cleaner. |

**Installation:**
```bash
cd apps/desktop && pnpm add chokidar@^4.0.3
```

**Version verification:**
- chokidar: 4.0.3 (latest v4 on npm, verified 2026-04-15)
- Electron: 41.1.0 (already in project devDependencies)

## Architecture Patterns

### Recommended Project Structure
```
apps/desktop/src/main/
  index.ts            # MODIFY: tray init, lifecycle changes, boot-to-tray detection
  window.ts           # MODIFY: intercept close → hide, export isBootToTray
  tray.ts             # NEW: Tray creation, context menu, double-click handler
  watcher.ts          # NEW: chokidar watcher lifecycle, debounce, scan+sync trigger
  diff-scan.ts        # NEW: Startup diff scan comparing SQLite vs filesystem
  library/
    library-ipc.ts    # MODIFY: add diff-scan-results IPC event, watcher status
    db.ts             # EXISTING: getIndexedFileMtimes() already provides what diff-scan needs
    scanner.ts        # EXISTING: scanFolder({ incremental: true }) reused by watcher
    sync-manager.ts   # EXISTING: startSync() called after watcher-triggered scan
  ipc.ts              # MODIFY: register watcher + auto-start IPC handlers
apps/desktop/src/shared/
  ipc-types.ts        # MODIFY: add autoStart to DesktopSettings, DiffScanResult type
apps/desktop/src/preload/
  main.ts             # MODIFY: expose onDiffScanResult listener
```

### Pattern 1: Tray Lifecycle Management
**What:** Create tray on app ready, keep reference to prevent GC, manage show/hide window
**When to use:** Always — tray must persist for entire app lifetime
**Example:**
```typescript
// src/main/tray.ts
import { Tray, Menu, nativeImage, app } from "electron";
import path from "node:path";
import { getMainWindow, focusMainWindow } from "./window";

let tray: Tray | null = null;

export function createTray(): void {
  const iconPath = path.join(__dirname, "../resources/tray-icon.png");
  tray = new Tray(nativeImage.createFromPath(iconPath));

  const contextMenu = Menu.buildFromTemplate([
    {
      label: "Open",
      click: () => focusMainWindow(),
    },
    { type: "separator" },
    {
      label: "Quit",
      click: () => {
        app.quit();
      },
    },
  ]);

  tray.setToolTip("DigSwap Desktop");
  tray.setContextMenu(contextMenu);
  tray.on("double-click", () => focusMainWindow());
}

export function destroyTray(): void {
  tray?.destroy();
  tray = null;
}
```

### Pattern 2: Close-to-Tray Window Interception
**What:** Intercept BrowserWindow close event, hide instead of close
**When to use:** On all close events except when app is explicitly quitting
**Example:**
```typescript
// In window.ts createMainWindow():
let isQuitting = false;

app.on("before-quit", () => { isQuitting = true; });

mainWindow.on("close", (event) => {
  if (!isQuitting) {
    event.preventDefault();
    mainWindow.hide();
  }
});
```

### Pattern 3: Debounced File Watcher
**What:** chokidar watches library root, debounces 2 minutes, triggers incremental scan + sync
**When to use:** After library root is configured
**Example:**
```typescript
// src/main/watcher.ts
import { watch, type FSWatcher } from "chokidar";
import path from "node:path";

const AUDIO_EXTENSIONS = new Set([
  ".mp3", ".flac", ".wav", ".ogg", ".m4a",
  ".aac", ".wma", ".opus", ".aiff",
]);
const IGNORED_FILES = new Set([".tmp", ".part", ".crdownload", "thumbs.db", ".ds_store"]);
const DEBOUNCE_MS = 2 * 60 * 1000; // 2 minutes

let watcher: FSWatcher | null = null;
let debounceTimer: NodeJS.Timeout | null = null;

export function startWatching(
  rootPath: string,
  onSettled: () => void,
): void {
  stopWatching();

  watcher = watch(rootPath, {
    ignoreInitial: true,
    persistent: true,
    depth: Infinity,
    awaitWriteFinish: {
      stabilityThreshold: 2000,
      pollInterval: 100,
    },
    ignored: (filePath: string, stats) => {
      // Allow directories to pass through
      if (stats?.isDirectory()) return false;
      const ext = path.extname(filePath).toLowerCase();
      const basename = path.basename(filePath).toLowerCase();
      if (IGNORED_FILES.has(ext) || IGNORED_FILES.has(basename)) return true;
      return !AUDIO_EXTENSIONS.has(ext);
    },
  });

  watcher.on("add", () => resetDebounce(onSettled));
  watcher.on("change", () => resetDebounce(onSettled));
  watcher.on("unlink", () => resetDebounce(onSettled));
  watcher.on("error", (err) => console.error("[watcher] error:", err));
}

function resetDebounce(callback: () => void): void {
  if (debounceTimer) clearTimeout(debounceTimer);
  debounceTimer = setTimeout(callback, DEBOUNCE_MS);
}

export function stopWatching(): void {
  if (debounceTimer) { clearTimeout(debounceTimer); debounceTimer = null; }
  if (watcher) { void watcher.close(); watcher = null; }
}
```

### Pattern 4: Boot-to-Tray via CLI Args
**What:** Detect auto-start via `--boot-to-tray` arg, skip showing window
**When to use:** When app is launched at Windows login
**Example:**
```typescript
// In index.ts:
const isBootToTray = process.argv.includes("--boot-to-tray");

// In window.ts createMainWindow():
if (!isBootToTray) {
  mainWindow.once("ready-to-show", () => mainWindow?.show());
}
// If boot-to-tray, window is created but never shown — tray is visible

// In ipc.ts for auto-start toggle:
app.setLoginItemSettings({
  openAtLogin: enabled,
  args: ["--boot-to-tray"],
});
```

### Anti-Patterns to Avoid
- **Storing tray in local variable:** Tray gets garbage collected if not stored in module-level variable. Always keep a persistent reference.
- **Using `window-all-closed` to quit on Windows:** Must change this handler since window can be hidden but not closed. Remove `app.quit()` from `window-all-closed`.
- **Polling-based file watching:** chokidar uses `fs.watch` by default which is event-based. Do not set `usePolling: true` unless on network drives.
- **ESM-only packages in Electron main:** The main process uses CJS builds via electron-vite. Avoid chokidar v5 (ESM-only).
- **Adding full lodash for debounce:** A 10-line custom debounce is simpler than adding a dependency.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| File system watching | Custom fs.watch wrapper | chokidar 4.x | Handles edge cases: rename events, directory creation, permission errors, write completion detection |
| Windows auto-start | Manual registry editing | `app.setLoginItemSettings()` | Electron handles Windows Registry keys correctly, including uninstall cleanup |
| System tray | Custom Windows shell integration | Electron `Tray` class | Cross-platform, handles icon DPI scaling, context menu, balloon notifications |
| Single-instance lock | File lock / socket approach | `app.requestSingleInstanceLock()` | Already built into Electron, handles process coordination correctly |

## Common Pitfalls

### Pitfall 1: Tray Garbage Collection
**What goes wrong:** Tray icon disappears from system tray after a few seconds
**Why it happens:** Tray object stored in local variable gets GC'd
**How to avoid:** Store tray reference in module-level `let tray: Tray | null`
**Warning signs:** Tray appears briefly then vanishes

### Pitfall 2: Window Close vs App Quit Confusion
**What goes wrong:** App cannot be quit because all close events are intercepted
**Why it happens:** `close` event handler always calls `preventDefault()` without checking if app is actually quitting
**How to avoid:** Use an `isQuitting` flag set on `before-quit` event. Only intercept close when `!isQuitting`.
**Warning signs:** "Quit" from tray menu doesn't work, app lingers in Task Manager

### Pitfall 3: chokidar Fires on Initial Scan
**What goes wrong:** Watcher fires `add` events for all existing files when started
**Why it happens:** Default behavior emits events for existing files during initial scan
**How to avoid:** Set `ignoreInitial: true` in chokidar options
**Warning signs:** Full re-scan triggers immediately after watcher starts

### Pitfall 4: Debounce Timer Not Cleared on Shutdown
**What goes wrong:** Scan/sync triggers after app has started shutting down
**Why it happens:** Debounce timer fires during app quit sequence, accessing closed DB
**How to avoid:** Clear debounce timer in `before-quit` handler. Call `stopWatching()` before `closeLibraryDb()`.
**Warning signs:** Crash on quit with "database is closed" errors

### Pitfall 5: Boot-to-Tray Window Still Shows Briefly
**What goes wrong:** Window flashes on screen before hiding when auto-started
**Why it happens:** `ready-to-show` event fires and shows window before boot-to-tray check
**How to avoid:** Do NOT call `mainWindow.show()` when `isBootToTray` is true. The existing `show: false` in BrowserWindow options already prevents showing. Only add the `ready-to-show` listener when NOT boot-to-tray.
**Warning signs:** Brief window flash on system startup

### Pitfall 6: Diff Scan Performance on Large Libraries
**What goes wrong:** Startup diff scan blocks the main process for seconds on 10K+ file libraries
**Why it happens:** Calling `fs.stat()` for every indexed file is synchronous I/O when done sequentially
**How to avoid:** Process files in parallel batches (e.g., `Promise.all` with chunks of 50). Show progress indicator if scan takes >2 seconds.
**Warning signs:** App feels frozen on startup

### Pitfall 7: Auto-Start Settings Desync
**What goes wrong:** "Start with Windows" toggle shows enabled but app doesn't start, or vice versa
**Why it happens:** `app.setLoginItemSettings()` changes registry but `DesktopSettings.autoStart` is stored in electron-store separately
**How to avoid:** Always call `app.setLoginItemSettings()` AND update `DesktopSettings` together. On startup, read actual login item status via `app.getLoginItemSettings()` to verify.
**Warning signs:** Toggle state doesn't match reality after app update

## Code Examples

### Diff Scan Implementation
```typescript
// src/main/diff-scan.ts
import { stat } from "node:fs/promises";
import type Database from "better-sqlite3";
import { getIndexedFileMtimes, getLibraryRoot } from "./library/db";
import { readdir } from "node:fs/promises";
import path from "node:path";

export interface DiffScanResult {
  added: number;
  removed: number;
  modified: number;
  totalIndexed: number;
  hasChanges: boolean;
}

const AUDIO_EXTENSIONS = new Set([
  ".mp3", ".flac", ".wav", ".ogg", ".m4a",
  ".aac", ".wma", ".opus", ".aiff",
]);

export async function runDiffScan(db: Database.Database): Promise<DiffScanResult> {
  const rootPath = getLibraryRoot(db);
  if (!rootPath) {
    return { added: 0, removed: 0, modified: 0, totalIndexed: 0, hasChanges: false };
  }

  const indexed = getIndexedFileMtimes(db); // Map<filePath, modifiedAt ISO string>

  // Discover current audio files on disk
  const entries = await readdir(rootPath, { recursive: true });
  const currentPaths = new Set<string>();
  for (const entry of entries) {
    const name = typeof entry === "string" ? entry : entry.toString();
    const ext = path.extname(name).toLowerCase();
    if (AUDIO_EXTENSIONS.has(ext)) {
      currentPaths.add(path.join(rootPath, name));
    }
  }

  let added = 0;
  let modified = 0;
  let removed = 0;

  // Check for new and modified files
  const BATCH_SIZE = 50;
  const paths = [...currentPaths];
  for (let i = 0; i < paths.length; i += BATCH_SIZE) {
    const batch = paths.slice(i, i + BATCH_SIZE);
    const stats = await Promise.all(
      batch.map(async (p) => {
        try { return { path: p, stat: await stat(p) }; }
        catch { return null; }
      })
    );
    for (const entry of stats) {
      if (!entry) continue;
      const existingMtime = indexed.get(entry.path);
      if (!existingMtime) {
        added++;
      } else if (entry.stat.mtime.toISOString() !== existingMtime) {
        modified++;
      }
    }
  }

  // Check for removed files
  for (const [indexedPath] of indexed) {
    if (!currentPaths.has(indexedPath)) {
      removed++;
    }
  }

  return {
    added,
    removed,
    modified,
    totalIndexed: indexed.size,
    hasChanges: added > 0 || removed > 0 || modified > 0,
  };
}
```

### Auto-Start IPC Handler
```typescript
// Added to ipc.ts
ipcMain.handle("desktop:set-auto-start", (_event, enabled: boolean) => {
  app.setLoginItemSettings({
    openAtLogin: enabled,
    args: enabled ? ["--boot-to-tray"] : [],
  });
  sessionStore.setSettings({ autoStart: enabled });
});

ipcMain.handle("desktop:get-auto-start", () => {
  const settings = app.getLoginItemSettings({ args: ["--boot-to-tray"] });
  return settings.openAtLogin;
});
```

### Modified Window Lifecycle
```typescript
// In index.ts — REPLACE window-all-closed handler:
// OLD: app.on("window-all-closed", () => { if (process.platform !== "darwin") app.quit(); });
// NEW: Do nothing — app stays alive in tray
app.on("window-all-closed", () => {
  // Intentionally empty — app runs in tray when window is closed/hidden
});
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| chokidar 3.x (fsevents native dep) | chokidar 4.x (pure JS, fs.watch) | Sep 2024 | Simpler install, no native rebuild needed |
| electron-auto-launch npm package | `app.setLoginItemSettings()` built-in | Available since Electron 1.x, stable | One fewer dependency, better Windows args support |
| lodash.debounce for file watch | Custom setTimeout/clearTimeout | Always viable | No extra dependency for trivial pattern |

## Open Questions

1. **Tray icon asset**
   - What we know: Need a 16x16 or 32x32 PNG for Windows system tray. Electron `nativeImage` handles DPI scaling.
   - What's unclear: No icon asset exists yet in the project.
   - Recommendation: Create a simple monochrome PNG icon (vinyl record silhouette) at `apps/desktop/resources/tray-icon.png`. Can use `nativeImage.createFromDataURL()` with an inline base64 PNG as a fallback during development.

2. **electron-auto-launch vs app.setLoginItemSettings()**
   - What we know: CONTEXT.md D-05 specifies `electron-auto-launch`. However, Claude's discretion section explicitly lists this as an area to research.
   - Research finding: `app.setLoginItemSettings()` is strictly superior for this project — built-in, no dependency, supports `args` for boot-to-tray detection, handles Windows Registry correctly. `electron-auto-launch` wraps the same registry keys but adds a dependency.
   - Recommendation: **Use `app.setLoginItemSettings()`**. This falls under Claude's discretion per CONTEXT.md.

3. **In-app toast vs Electron Notification for diff scan results**
   - What we know: D-06 says "shows toast/banner notification with results"
   - Options: (a) Electron `Notification` API — shows native Windows toast, works even when window is hidden. (b) IPC event to renderer for in-app toast — requires window to be visible.
   - Recommendation: Send IPC event with `DiffScanResult` to renderer. If window is visible, renderer shows in-app toast (consistent with existing UI). If window is hidden (boot-to-tray), use `Notification` API for native OS notification.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Electron | All features | Yes | 41.1.0 | -- |
| better-sqlite3 | Diff scan (getIndexedFileMtimes) | Yes | 12.9.0 | -- |
| chokidar | File watching (DAEMON-03) | No (needs install) | 4.0.3 target | -- |
| electron-store | Settings persistence | Yes | 8.2.0 | -- |

**Missing dependencies with no fallback:**
- chokidar 4.0.3 — must be installed: `pnpm add chokidar@^4.0.3`

**Missing dependencies with fallback:**
- None

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest 3.x |
| Config file | `apps/desktop/vitest.config.ts` |
| Quick run command | `cd apps/desktop && pnpm test` |
| Full suite command | `cd apps/desktop && pnpm test` |

### Phase Requirements -> Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| DAEMON-01 | Close button hides window instead of quitting | unit | `cd apps/desktop && pnpm vitest run src/main/tray.test.ts -t "close hides"` | No — Wave 0 |
| DAEMON-02 | Tray menu has Open + Quit, double-click opens | unit | `cd apps/desktop && pnpm vitest run src/main/tray.test.ts -t "context menu"` | No — Wave 0 |
| DAEMON-03 | chokidar watches library root, debounced scan+sync | unit | `cd apps/desktop && pnpm vitest run src/main/watcher.test.ts` | No — Wave 0 |
| DAEMON-04 | Auto-start toggle sets login item settings | unit | `cd apps/desktop && pnpm vitest run src/main/tray.test.ts -t "auto-start"` | No — Wave 0 |
| DAEMON-05 | Second instance focuses existing window | unit | `cd apps/desktop && pnpm vitest run src/main/tray.test.ts -t "single-instance"` | No — Wave 0 |
| SCAN-05 | Diff scan detects added/removed/modified files | unit | `cd apps/desktop && pnpm vitest run src/main/diff-scan.test.ts` | No — Wave 0 |

### Sampling Rate
- **Per task commit:** `cd apps/desktop && pnpm test`
- **Per wave merge:** `cd apps/desktop && pnpm test`
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps
- [ ] `apps/desktop/src/main/tray.test.ts` — covers DAEMON-01, DAEMON-02, DAEMON-04, DAEMON-05
- [ ] `apps/desktop/src/main/watcher.test.ts` — covers DAEMON-03
- [ ] `apps/desktop/src/main/diff-scan.test.ts` — covers SCAN-05
- [ ] Mocks needed: `electron` module (Tray, Menu, app, BrowserWindow), `chokidar`, `fs/promises`

## Project Constraints (from CLAUDE.md)

- **Stack:** Electron desktop app with better-sqlite3, electron-store, TypeScript
- **P2P:** WebRTC only, no server-side file storage (not relevant to this phase)
- **Security:** OWASP Top 10 (not directly impacted by this phase)
- **Conventions:** IPC pattern is `ipcMain.handle("desktop:channel", handler)`, settings via `getSettings()`/`setSettings()`, module-level singleton pattern for DB/window/tray
- **Build:** electron-vite for CJS main process builds — chokidar must be CJS-compatible (v4, not v5)

## Sources

### Primary (HIGH confidence)
- [Electron Tray API](https://www.electronjs.org/docs/latest/api/tray) — Tray class methods, events, context menu
- [Electron app API](https://www.electronjs.org/docs/latest/api/app) — setLoginItemSettings, getLoginItemSettings, before-quit, window-all-closed
- [chokidar GitHub](https://github.com/paulmillr/chokidar) — v4 API, ignored filter, awaitWriteFinish, ignoreInitial
- Existing codebase: `apps/desktop/src/main/index.ts`, `window.ts`, `ipc.ts`, `library/db.ts`, `library/scanner.ts`, `library/sync-manager.ts` — verified integration points

### Secondary (MEDIUM confidence)
- [Electron issue #25081](https://github.com/electron/electron/issues/25081) — Auto launch to tray pattern with --hidden arg
- [Electron issue #6893](https://github.com/electron/electron/issues/6893) — Boot minimized to tray on Windows startup
- npm registry — chokidar 4.0.3 version verified, electron-auto-launch 5.0.7 version verified

### Tertiary (LOW confidence)
- None

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — chokidar 4.x is well-established, Electron Tray/auto-start are built-in APIs
- Architecture: HIGH — all integration points verified in existing codebase, patterns align with established project conventions
- Pitfalls: HIGH — common Electron tray pitfalls are well-documented in community issues

**Research date:** 2026-04-15
**Valid until:** 2026-05-15 (stable domain, 30 days)
