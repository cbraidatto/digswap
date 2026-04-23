# Architecture: Local Library Integration

**Domain:** Local folder scan, AI metadata, system tray daemon, file watcher, collection sync
**Researched:** 2026-04-13
**Confidence:** HIGH (existing patterns well-established, new components follow proven Electron idioms)

## Existing Architecture Summary

The desktop app follows a clean separation:

```
index.ts (app lifecycle)
  -> DesktopSessionStore (electron-store, encrypted vault)
  -> DesktopSupabaseAuth (auth runtime)
  -> DesktopTradeRuntime (trade lifecycle, WebRTC)
  -> registerDesktopIpc() (IPC handler registration)
  -> createMainWindow() (BrowserWindow, remote/local shell)

Preload (trade.ts):
  -> contextBridge exposes desktopBridge + desktopShell
  -> All IPC via ipcRenderer.invoke / ipcRenderer.on

Renderer (AppShell):
  -> React screens: Login, Inbox, Lobby, AudioPrep, Transfer, Completion, Settings
  -> Calls window.desktopBridge.* methods
```

**Key patterns already established:**
- Runtime classes in main process (DesktopTradeRuntime pattern)
- IPC registration via a single `registerDesktopIpc()` function
- Bridge interfaces typed in `shared/ipc-types.ts`
- electron-store for persistent local state
- music-metadata already a dependency (used in ffmpeg-pipeline)
- `addedVia` field on collection_items supports multiple sources ("discogs", "manual", "crate", "youtube")

## Recommended Architecture

### New Components Overview

```
apps/desktop/src/main/
  index.ts                    [MODIFY] -- add tray, library runtime init, close-to-tray
  ipc.ts                      [MODIFY] -- register library IPC channels
  window.ts                   [MODIFY] -- close-to-tray behavior
  tray.ts                     [NEW]    -- system tray icon + context menu
  library/
    library-runtime.ts        [NEW]    -- orchestrates scan, watch, sync (like TradeRuntime)
    folder-scanner.ts         [NEW]    -- recursive audio file discovery
    metadata-extractor.ts     [NEW]    -- music-metadata tag reading + filename parsing
    ai-metadata.ts            [NEW]    -- Gemini Flash API for ambiguous metadata
    file-watcher.ts           [NEW]    -- chokidar watcher for real-time changes
    local-index.ts            [NEW]    -- electron-store based file index (hash -> metadata)
    sync-engine.ts            [NEW]    -- diff local index vs server, push changes
    youtube-search.ts         [NEW]    -- YouTube Data API v3 search per release

apps/desktop/src/shared/
  ipc-types.ts                [MODIFY] -- add library bridge types

apps/desktop/src/preload/
  trade.ts                    [MODIFY] -- expose library bridge methods

apps/desktop/src/renderer/src/
  LibraryScreen.tsx           [NEW]    -- folder selection, scan progress, file list
  SettingsScreen.tsx          [MODIFY] -- add library folder, auto-start, tray settings

apps/web/src/
  lib/db/schema/
    collections.ts            [NO CHANGE] -- addedVia "local" just a new string value
    releases.ts               [NO CHANGE] -- discogsId already nullable
  actions/
    library-sync.ts           [NEW]    -- server action to receive local collection batch upserts
  app/api/desktop/
    library-sync/route.ts     [NEW]    -- API route for batch sync from desktop
```

### Component Boundaries

| Component | Responsibility | Communicates With |
|-----------|---------------|-------------------|
| `LibraryRuntime` | Orchestrates scan/watch/sync lifecycle, holds state | FolderScanner, FileWatcher, MetadataExtractor, AiMetadata, SyncEngine, LocalIndex |
| `FolderScanner` | Recursive directory walk, discovers audio files | LibraryRuntime (returns file list) |
| `MetadataExtractor` | Reads ID3/Vorbis tags + parses filename/path structure | LibraryRuntime (returns structured metadata) |
| `AiMetadata` | Calls Gemini Flash for ambiguous/missing metadata | MetadataExtractor (enriches failed extractions) |
| `FileWatcher` | Monitors folders for add/remove/rename events | LibraryRuntime (emits change events) |
| `LocalIndex` | Persists file index to electron-store (path, hash, metadata, lastModified) | LibraryRuntime, SyncEngine |
| `SyncEngine` | Diffs local index against server, pushes batch upserts | LibraryRuntime, Supabase client |
| `TrayManager` | System tray icon, context menu, notifications | index.ts lifecycle |
| `YouTubeSearch` | Finds YouTube video for identified releases | SyncEngine (enriches before push) |

### Data Flow

#### Initial Scan

```
User clicks "Add Folder" in LibraryScreen
  -> IPC: desktop:library-select-folder
  -> dialog.showOpenDialog (main process)
  -> LibraryRuntime.addFolder(path)
    -> FolderScanner.scan(path)
      -> Walks directory tree, filters audio extensions
      -> Returns: { path, size, mtime }[]
    -> For each file:
      -> MetadataExtractor.extract(filePath)
        -> music-metadata.parseFile() for ID3/Vorbis tags
        -> If tags incomplete: parse filename (Artist - Album - Track.flac)
        -> If still ambiguous: queue for AI
      -> If AI queue non-empty:
        -> AiMetadata.inferBatch(items)
          -> Gemini Flash structured output: { artist, album, track, year, genre }
      -> LocalIndex.upsert(path, hash, metadata)
    -> SyncEngine.pushBatch(newItems)
      -> POST /api/desktop/library-sync
      -> Upserts releases + collection_items with addedVia="local"
    -> IPC event: desktop:library-scan-progress { scanned, total, current }
    -> IPC event: desktop:library-scan-complete { added, updated, errors }
  -> FileWatcher.watch(path) starts
```

#### Real-time File Watch (Tray Mode)

```
chokidar detects file add/unlink/change
  -> FileWatcher emits "file-added" | "file-removed" | "file-changed"
  -> LibraryRuntime handles event:
    - file-added: extract metadata, index, queue sync
    - file-removed: mark removed in index, queue sync (delete from server)
    - file-changed: re-extract metadata if mtime changed, queue sync
  -> SyncEngine debounces (5s window) then pushes batch
  -> If window is open: IPC event desktop:library-file-changed
```

#### Startup Diff Scan

```
app.whenReady()
  -> LibraryRuntime.initialize()
    -> Load persisted watched folders from LocalIndex
    -> For each folder:
      -> FolderScanner.scan(path)
      -> Diff against LocalIndex:
        - New files (path not in index): extract, index, queue add
        - Removed files (in index but not on disk): queue delete
        - Changed files (mtime differs): re-extract, queue update
      -> SyncEngine.pushBatch(changes)
    -> FileWatcher.watch(allFolders) -- resume watching
```

## New IPC Channels

### Invoke (renderer -> main, returns Promise)

| Channel | Args | Returns | Purpose |
|---------|------|---------|---------|
| `desktop:library-select-folder` | none | `string \| null` | Native folder picker dialog |
| `desktop:library-add-folder` | `folderPath: string` | `void` | Start scanning + watching a folder |
| `desktop:library-remove-folder` | `folderPath: string` | `void` | Stop watching, optionally remove items |
| `desktop:library-get-folders` | none | `WatchedFolder[]` | List all watched folders with stats |
| `desktop:library-get-items` | `{ offset, limit, folder? }` | `LocalLibraryItem[]` | Paginated local index items |
| `desktop:library-rescan` | `folderPath?: string` | `void` | Force rescan (one folder or all) |
| `desktop:library-get-sync-status` | none | `LibrarySyncStatus` | Last sync time, pending count, errors |
| `desktop:tray-get-settings` | none | `TraySettings` | Close-to-tray, auto-start prefs |
| `desktop:tray-set-settings` | `Partial<TraySettings>` | `void` | Update tray preferences |

### Events (main -> renderer, push via webContents.send)

| Channel | Payload | Purpose |
|---------|---------|---------|
| `desktop:library-scan-progress` | `{ folder, scanned, total, currentFile }` | Scan progress bar |
| `desktop:library-scan-complete` | `{ folder, added, updated, removed, errors }` | Scan finished |
| `desktop:library-file-changed` | `{ type, path, metadata? }` | Real-time file change notification |
| `desktop:library-sync-status` | `LibrarySyncStatus` | Sync state changed |
| `desktop:library-ai-progress` | `{ processed, total, current }` | AI metadata inference progress |

## New IPC Types (ipc-types.ts additions)

```typescript
export interface WatchedFolder {
  path: string;
  fileCount: number;
  lastScannedAt: string | null;
  watching: boolean;
}

export interface LocalLibraryItem {
  filePath: string;
  fileHash: string;
  fileSizeBytes: number;
  lastModified: string;
  metadata: LocalAudioMetadata;
  syncedAt: string | null;
  serverCollectionItemId: string | null;
}

export interface LocalAudioMetadata {
  artist: string | null;
  album: string | null;
  title: string | null;
  trackNumber: number | null;
  year: number | null;
  genre: string[];
  format: string;                 // codec: flac, mp3, etc.
  bitrate: number;
  sampleRate: number;
  duration: number;
  source: "tags" | "filename" | "ai";
  confidence: number;             // 0-1, 1 = from clean tags
}

export interface LibrarySyncStatus {
  lastSyncAt: string | null;
  pendingAdds: number;
  pendingDeletes: number;
  pendingUpdates: number;
  syncing: boolean;
  lastError: string | null;
}

export interface TraySettings {
  closeToTray: boolean;
  autoStartOnLogin: boolean;
  showNotifications: boolean;
}

export interface LibraryScanProgress {
  folder: string;
  scanned: number;
  total: number;
  currentFile: string;
}

export interface LibraryScanComplete {
  folder: string;
  added: number;
  updated: number;
  removed: number;
  errors: string[];
}

export interface DesktopBridgeLibrary {
  librarySelectFolder(): Promise<string | null>;
  libraryAddFolder(folderPath: string): Promise<void>;
  libraryRemoveFolder(folderPath: string): Promise<void>;
  libraryGetFolders(): Promise<WatchedFolder[]>;
  libraryGetItems(opts: { offset: number; limit: number; folder?: string }): Promise<LocalLibraryItem[]>;
  libraryRescan(folderPath?: string): Promise<void>;
  libraryGetSyncStatus(): Promise<LibrarySyncStatus>;
  trayGetSettings(): Promise<TraySettings>;
  traySetSettings(settings: Partial<TraySettings>): Promise<void>;
  onLibraryScanProgress(listener: (event: LibraryScanProgress) => void): () => void;
  onLibraryScanComplete(listener: (event: LibraryScanComplete) => void): () => void;
  onLibraryFileChanged(listener: (event: { type: string; path: string }) => void): () => void;
  onLibrarySyncStatus(listener: (event: LibrarySyncStatus) => void): () => void;
}
```

## DB Schema Changes

### collection_items -- NO migration needed

The `addedVia` column is `varchar(20)`. Adding "local" as a value is just a new string. Existing RLS policies work unchanged (they check `userId = auth.uid()`).

### releases table -- NO migration needed

The `discogsId` column is already nullable. Local-only releases can be created with `discogsId = null`. The `youtubeVideoId` column is also nullable and ready for YouTube search results.

### Local file index -- electron-store (NOT PostgreSQL)

The local file index lives on the user's machine. Only resolved metadata is synced to the server.

```typescript
// PersistedDesktopState additions in session-store.ts
interface PersistedDesktopState {
  // ... existing fields ...
  watchedFolders: string[];
  localFileIndex: Record<string, LocalFileIndexEntry>;  // keyed by file path
  traySettings: TraySettings;
}

interface LocalFileIndexEntry {
  fileSizeBytes: number;
  lastModified: number;        // mtime as epoch ms
  metadata: LocalAudioMetadata;
  serverReleaseId: string | null;
  serverCollectionItemId: string | null;
  syncedAt: string | null;
}
```

**Performance note:** For large collections (5000+ files), electron-store serializes to a single JSON file. If performance degrades, migrate to `better-sqlite3`. Start with electron-store -- it is proven in this codebase and sufficient for typical vinyl collections (most diggers have 500-3000 files).

### New API endpoint: POST /api/desktop/library-sync

```typescript
interface LibrarySyncRequest {
  items: LibrarySyncItem[];
  deletedItemIds: string[];     // server collection_item IDs to remove
}

interface LibrarySyncItem {
  localPath: string;            // dedup key (per-user unique)
  metadata: {
    artist: string;
    album: string;
    title: string | null;
    year: number | null;
    genre: string[];
    format: string;
    country: string | null;
  };
  audioSpecs: {
    codec: string;
    bitrate: number;
    sampleRate: number;
    duration: number;
  };
}

interface LibrarySyncResponse {
  synced: number;
  created: number;
  updated: number;
  deleted: number;
  items: Array<{ localPath: string; releaseId: string; collectionItemId: string }>;
  errors: Array<{ path: string; error: string }>;
}
```

**Sync logic on the server:**
1. For each item, match release: exact match on `artist + title + year` in `releases` table
2. No match: create new release (`discogsId = null`)
3. Upsert `collection_items` with `addedVia = 'local'`, audio specs in existing columns
4. Return server IDs so desktop can update its local index
5. Batch limit: 100 items per request

## System Tray Integration

### tray.ts (new file)

```typescript
import { Tray, Menu, nativeImage, app } from "electron";

export class TrayManager {
  private tray: Tray | null = null;

  create(iconPath: string, callbacks: {
    onShow: () => void;
    onRescan: () => void;
    onQuit: () => void;
  }) {
    const icon = nativeImage.createFromPath(iconPath);
    this.tray = new Tray(icon.resize({ width: 16, height: 16 }));
    
    const contextMenu = Menu.buildFromTemplate([
      { label: "Open DigSwap", click: callbacks.onShow },
      { type: "separator" },
      { label: "Library: watching 0 folders", enabled: false, id: "status" },
      { label: "Rescan Now", click: callbacks.onRescan },
      { type: "separator" },
      { label: "Quit", click: callbacks.onQuit },
    ]);
    
    this.tray.setToolTip("DigSwap Desktop");
    this.tray.setContextMenu(contextMenu);
    this.tray.on("double-click", callbacks.onShow);
  }

  updateStatus(folderCount: number, fileCount: number) {
    // Rebuild context menu with updated status label
  }

  destroy() {
    this.tray?.destroy();
    this.tray = null;
  }
}
```

### index.ts modifications

```typescript
// In app.whenReady():
const trayManager = new TrayManager();
const libraryRuntime = new LibraryRuntime(sessionStore, authRuntime);
await libraryRuntime.initialize();

// Create tray after window
trayManager.create(trayIconPath, {
  onShow: () => focusMainWindow(),
  onRescan: () => libraryRuntime.rescanAll(),
  onQuit: () => { app.isQuitting = true; app.quit(); },
});

// Pass libraryRuntime to registerDesktopIpc
registerDesktopIpc({ authRuntime, sessionStore, tradeRuntime, libraryRuntime });

// Modify window-all-closed:
app.on("window-all-closed", () => {
  const traySettings = sessionStore.getTraySettings();
  if (traySettings.closeToTray) return; // Stay alive in tray
  if (process.platform !== "darwin") app.quit();
});

// Auto-start:
app.setLoginItemSettings({
  openAtLogin: sessionStore.getTraySettings().autoStartOnLogin,
  openAsHidden: true,
});

// Shutdown:
app.on("before-quit", () => {
  libraryRuntime.shutdown();
  trayManager.destroy();
});
```

### window.ts modifications

```typescript
// In createMainBrowserWindow, add close interception:
window.on("close", (event) => {
  if (sessionStore.getTraySettings().closeToTray && !app.isQuitting) {
    event.preventDefault();
    window.hide();
  }
});
```

## Patterns to Follow

### Pattern 1: Runtime Class (established by TradeRuntime)

`LibraryRuntime` follows the exact same shape as `DesktopTradeRuntime`:
- Constructor takes `sessionStore` + `authRuntime`
- `initialize()` called during app startup
- `shutdown()` called during app quit
- Event emitter methods: `onScanProgress()`, `onScanComplete()`, `onSyncStatus()`
- Registered in `registerDesktopIpc()` alongside trade runtime

### Pattern 2: IPC Registration (single point)

All library IPC handlers go in `registerDesktopIpc()` in `ipc.ts`, not in a separate file. This keeps the single-point registration pattern.

### Pattern 3: Debounced Batch Sync

```typescript
// In SyncEngine
private syncTimer: NodeJS.Timeout | null = null;
private pendingChanges: Map<string, "add" | "update" | "delete"> = new Map();

queueChange(path: string, type: "add" | "update" | "delete") {
  this.pendingChanges.set(path, type);
  if (this.syncTimer) clearTimeout(this.syncTimer);
  this.syncTimer = setTimeout(() => this.flush(), 5_000);
}
```

## Anti-Patterns to Avoid

### Anti-Pattern 1: Computing SHA-256 for every file during scan

**Why bad:** SHA-256 of a 50MB FLAC takes ~200ms. 5000 files = 17 minutes.
**Instead:** Use `mtime + size` as the fast change detection key. Only compute full hash when needed for trade integrity (existing pipeline already does this).

### Anti-Pattern 2: Syncing on every file event

**Why bad:** Copying 500 files triggers 500 events in seconds.
**Instead:** Debounce with 5s window, batch into single API call (max 100 items).

### Anti-Pattern 3: Calling Gemini Flash for every file

**Why bad:** Wasteful API calls for files with clean tags.
**Instead:** Only invoke AI when no ID3 tags present AND filename parsing produced low confidence (<0.5).

### Anti-Pattern 4: Watching system directories or unbounded depth

**Why bad:** CPU/memory exhaustion, inotify limits on Linux.
**Instead:** Limit depth to 10 levels, ignore non-audio files, only watch user-selected folders.

### Anti-Pattern 5: Creating a separate BrowserWindow for library UI

**Why bad:** Contradicts existing AppShell pattern, adds complexity.
**Instead:** Add LibraryScreen as a new screen within AppShell (same as Settings, Inbox, etc.).

## AI Metadata Pipeline

### When to invoke AI

```
1. ID3v2 / Vorbis / FLAC tags (via music-metadata)  -> confidence: 1.0  -> NO AI
2. ID3v1 tags (minimal)                               -> confidence: 0.8  -> NO AI
3. Filename pattern matching successful                -> confidence: 0.6  -> NO AI
4. Filename parsing + folder structure                 -> confidence: 0.5  -> MAYBE AI
5. No tags, no parseable filename                      -> confidence: 0.1  -> YES AI
```

Only items with confidence < 0.5 get queued for AI. Batch up to 20 items per Gemini Flash call.

### Gemini Flash configuration

```typescript
import { GoogleGenAI } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

// Use structured output (responseMimeType: "application/json")
// Model: gemini-2.5-flash (cheapest, fastest)
// Cost: ~$0.075/1M input tokens
// 20 files per batch = ~2000 tokens = ~$0.00015 per batch
// 10,000 files worst case = ~$0.075 total
```

**New dependency:** `@google/genai` -- add to desktop package.json.
**New env var:** `GEMINI_API_KEY` -- add to desktop config resolution.

## File Watcher Configuration

### chokidar v4

```typescript
import { watch } from "chokidar";

const AUDIO_EXTENSIONS = /\.(flac|wav|mp3|aiff|aif|ogg|opus|m4a|wma|ape|wv)$/i;

const watcher = watch(folderPath, {
  ignored: [
    /(^|[\/\\])\../,           // dotfiles
    (path: string) => !AUDIO_EXTENSIONS.test(path) && !isDirectory(path),
  ],
  persistent: true,
  depth: 10,
  ignoreInitial: true,          // we do our own initial scan
  awaitWriteFinish: {
    stabilityThreshold: 2000,   // wait 2s after last write
    pollInterval: 500,
  },
  usePolling: false,
});
```

**New dependency:** `chokidar@^4.0.0` -- add to desktop package.json.

## YouTube Search Integration

The `releases` table already has a `youtubeVideoId` column. YouTube search slots directly in.

```
YouTube Data API v3: 10,000 units/day free
Search costs 100 units = 100 searches/day
Strategy: Queue searches, 1 per 2s, cache results
Most vinyl releases will have YouTube matches
```

**New env var:** `YOUTUBE_API_KEY` -- add to desktop config resolution.

## New Dependencies Summary

| Package | Version | Purpose |
|---------|---------|---------|
| `chokidar` | `^4.0.0` | File watching |
| `@google/genai` | `^1.48.0` | Gemini Flash AI metadata |

Both added to `apps/desktop/package.json`. No new dependencies for the web app.

## Scalability Considerations

| Concern | 100 files | 5,000 files | 50,000 files |
|---------|-----------|-------------|--------------|
| Scan time | < 5s | ~30s | ~5min |
| Local index | electron-store OK | electron-store OK (~2MB) | Consider better-sqlite3 |
| AI calls | ~5 items | ~500 items (25 batches) | ~5000 items (queue overnight) |
| Server sync | 1 API call | 50 calls | 500 calls (throttle 2/sec) |
| chokidar memory | Negligible | ~10MB | ~50MB |

## Build Order

### Phase 1: Local Index + Folder Scanner (no server, no AI)
1. `local-index.ts` -- electron-store wrapper for file index
2. `metadata-extractor.ts` -- music-metadata tag reading + filename parsing
3. `folder-scanner.ts` -- recursive walk + metadata extraction
4. IPC channels: select-folder, add-folder, get-folders, get-items
5. `LibraryScreen.tsx` -- folder picker, scan progress, file list display
6. **Testable:** Scan a folder, read tags, display in UI

### Phase 2: Sync Engine (server integration)
1. `POST /api/desktop/library-sync` API route + server action
2. `sync-engine.ts` -- batch upsert to server
3. Extend LibraryScreen to show sync status
4. **Testable:** Local items appear on web collection page with addedVia="local"

### Phase 3: File Watcher + Tray
1. `file-watcher.ts` -- chokidar integration
2. `tray.ts` -- system tray icon + context menu
3. Modify `index.ts` -- close-to-tray, tray lifecycle
4. Modify `window.ts` -- hide on close
5. Startup diff scan in LibraryRuntime.initialize()
6. **Testable:** Add file to watched folder, appears in collection. Close to tray, app runs.

### Phase 4: AI Metadata + YouTube
1. `ai-metadata.ts` -- Gemini Flash integration
2. Extend MetadataExtractor with AI fallback
3. `youtube-search.ts` -- YouTube Data API
4. **Testable:** Files with no tags get AI-inferred metadata. Releases get YouTube links.

### Phase 5: Auto-Start + Polish
1. `app.setLoginItemSettings()` for Windows auto-start
2. Tray notifications for wantlist matches
3. Settings UI for all new preferences
4. Error handling, retry logic
5. **Testable:** App starts with Windows, watches folders, syncs silently

**Rationale:** Phase 1 delivers visible value (see local files). Phase 2 connects to existing collection system. Phase 3 adds daemon behavior. Phase 4 enhances with AI. Phase 5 polishes UX.

## Sources

- [Chokidar v4 GitHub](https://github.com/paulmillr/chokidar) -- HIGH confidence
- [Electron Tray API](https://www.electronjs.org/docs/latest/api/tray) -- HIGH confidence
- [Electron app.setLoginItemSettings](https://www.electronjs.org/docs/latest/api/app) -- HIGH confidence
- [Electron minimize to tray](https://dev.to/jenueldev/electronjs-how-to-minimizeclose-window-to-system-tray-or-in-the-background-11c6) -- MEDIUM confidence
- [@google/genai npm](https://www.npmjs.com/package/@google/genai) -- HIGH confidence
- [Gemini API docs](https://ai.google.dev/gemini-api/docs/quickstart) -- HIGH confidence
- [music-metadata npm](https://www.npmjs.com/package/music-metadata) -- HIGH confidence, already in use
- [YouTube Data API v3](https://developers.google.com/youtube/v3) -- HIGH confidence
- [Chokidar and Electron integration](https://www.hendrik-erz.de/post/electron-chokidar-and-native-nodejs-modules-a-horror-story-from-integration-hell) -- MEDIUM confidence
