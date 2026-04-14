# Phase 29: Local Index + Folder Scanner - Research

**Researched:** 2026-04-14
**Domain:** Electron desktop — filesystem scanning, audio metadata extraction, SQLite indexing
**Confidence:** HIGH

## Summary

This phase adds a local music library scanner to the existing Electron desktop app. The core work involves three technical domains: (1) recursive filesystem scanning filtered to FLAC/WAV/AIFF, (2) audio metadata extraction via the already-installed `music-metadata` package, and (3) SQLite-backed indexing via `better-sqlite3` — a new native dependency requiring electron-rebuild.

The project already has strong patterns to follow: `dialog.showOpenDialog` for folder picking (used in ipc.ts), `music-metadata` for audio probing (used in ffmpeg-pipeline.ts), `TransferProgressEvent` for IPC progress (used in trade runtime), and the preload bridge pattern (trade.ts). The scanner module is new but integrates into well-established architecture.

**Primary recommendation:** Use `better-sqlite3` synchronously on the main process (no worker thread needed for the scan sizes expected — 5000-10000 files). Run the filesystem walk + metadata extraction in an async loop with periodic `setImmediate` yields to keep the event loop responsive, and throttle IPC progress events to 50ms intervals as specified.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- D-01: Index Storage — SQLite via better-sqlite3, stored in app.getPath('userData')
- D-02: Supported Formats — FLAC, WAV, AIFF only (no lossy, no DSD)
- D-03: Scan Progress UX — Determinate bar + file ticker, ScanProgressEvent type, 50ms IPC throttle
- D-04: Metadata Inference — 5 specific folder-hierarchy patterns with confidence flags (high/low)
- D-05: Library UI — Dual view (flat list + album-grouped), no search/filter
- D-06: Re-scan Strategy — Incremental (mtime-first, hash if changed) + full re-scan button
- D-07: Single Library Root — one folder, native OS picker
- D-08: Error Handling — Skip and summarize, scan never stops for individual file errors
- D-09: SQLite Schema — Extended fields including fileSize, sampleRate, bitDepth, confidence flags, syncedAt/syncHash
- D-10: Navigation — "My Library" as new tab in AppShell (Tab = "inbox" | "settings" | "library")
- D-11: Empty State — Central folder icon + "Escolher Pasta" CTA
- D-12: Scan Progress Replaces Library View — in-place transition

### Claude's Discretion
- Threading strategy for scan (worker thread vs async main process with yields)
- Exact SQLite database file path within userData
- Progress bar visual styling and animation
- Album grouping logic for "Unknown Album" entries
- Exact shade/opacity for inferred metadata color differentiation

### Deferred Ideas (OUT OF SCOPE)
- Search/filter in library
- Multiple library roots
- DSD format support (dsf/dff)
- MP3/lossy format support
- BPM/key detection
- Album art extraction
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| SCAN-01 | User can select a local folder as music library root via native OS folder picker | `dialog.showOpenDialog` with `openDirectory` — already used in ipc.ts for download path selection. Direct reuse pattern. |
| SCAN-02 | User can trigger recursive scan with real-time progress | `fs.readdir` with `recursive: true` (Node 18.17+, Electron 41 bundles Node 22). IPC throttle at 50ms via `TransferProgressEvent` pattern. |
| SCAN-03 | App extracts metadata from audio file tags (ID3v2, Vorbis, FLAC) | `music-metadata` v10+ already installed. `parseFile()` returns `common.artist`, `common.album`, `common.title`, `common.year`, `common.track.no`, `format.sampleRate`, `format.bitsPerSample`, `format.bitrate`, `format.duration`, `format.codec`. |
| SCAN-04 | App infers metadata from filename and folder structure when tags missing | 5 regex patterns from D-04 applied to relative file path. Confidence flags per field. Pure string parsing, no external library needed. |
</phase_requirements>

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| better-sqlite3 | 12.9.0 | SQLite database for local index | Synchronous API perfect for Electron main process. ~100x faster than async sqlite3. Prebuilt binaries for Electron. |
| music-metadata | 10.x (already installed) | Audio tag extraction | Already in project dependencies (ffmpeg-pipeline.ts). Supports FLAC (Vorbis comments), WAV (RIFF INFO/ID3v2), AIFF (ID3v2). Returns common tags + format specs. |
| @electron/rebuild | 4.0.3 | Rebuild native modules for Electron | Required to compile better-sqlite3 against Electron's Node.js ABI. One-time postinstall step. |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| crypto (built-in) | Node.js built-in | SHA-256 file hashing | Already used in `computeFileSha256` in ffmpeg-pipeline.ts. Reuse for incremental scan hash comparison. |
| fs/promises (built-in) | Node.js built-in | Recursive directory walk, file stat | `readdir({recursive: true})` supported in Node 18.17+. Electron 41 ships Node 22. |
| path (built-in) | Node.js built-in | Path parsing for metadata inference | `path.parse()`, `path.relative()` for folder-hierarchy pattern matching. |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| better-sqlite3 (sync) | sql.js (WASM SQLite) | sql.js runs in any context (renderer included) but is 2-5x slower for writes and lacks native filesystem integration. better-sqlite3's sync API is ideal for Electron main process. |
| fs.readdir recursive | glob / fast-glob | Built-in recursive readdir is sufficient and zero-dependency. fast-glob adds pattern matching we don't need since we filter by extension ourselves. |
| Worker thread for scan | Async loop with yields | Worker thread adds IPC serialization overhead and complexity. For 5000-10000 files, an async loop with `setImmediate` yields keeps the main process responsive without the complexity. Only consider worker thread if scanning 50K+ file libraries becomes a requirement. |

**Installation:**
```bash
cd apps/desktop
pnpm add better-sqlite3
pnpm add -D @types/better-sqlite3 @electron/rebuild
```

**Postinstall rebuild script (package.json):**
```json
{
  "scripts": {
    "postinstall": "electron-rebuild -f -w better-sqlite3",
    "rebuild": "electron-rebuild -f -w better-sqlite3"
  }
}
```

**Version verification:** better-sqlite3 12.9.0 verified via `npm view` on 2026-04-14. @electron/rebuild 4.0.3 verified same date.

## Architecture Patterns

### Recommended Project Structure
```
apps/desktop/src/
├── main/
│   ├── library/
│   │   ├── db.ts              # SQLite connection, schema init, migrations
│   │   ├── scanner.ts         # Recursive walk + metadata extraction orchestrator
│   │   ├── metadata-parser.ts # music-metadata wrapper + folder inference
│   │   ├── folder-inference.ts # 5 regex patterns for path-based metadata
│   │   └── library-ipc.ts     # IPC handlers for library operations
│   └── ...existing files...
├── renderer/src/
│   ├── LibraryScreen.tsx      # Main library screen (state machine: empty/scanning/error-summary/library)
│   ├── LibraryListView.tsx    # Flat table view component
│   ├── LibraryAlbumView.tsx   # Album-grouped view component
│   └── ...existing files...
├── preload/
│   └── trade.ts               # Extend with library bridge methods (or new library.ts preload)
└── shared/
    └── ipc-types.ts           # Add ScanProgressEvent, LibraryBridge, LibraryEntry types
```

### Pattern 1: SQLite Database Lifecycle
**What:** Single database connection opened at app startup, closed at app quit.
**When to use:** All SQLite access in Electron main process.
**Example:**
```typescript
// Source: better-sqlite3 docs + project patterns
import Database from "better-sqlite3";
import { app } from "electron";
import path from "node:path";

let db: Database.Database | null = null;

export function getLibraryDb(): Database.Database {
  if (!db) {
    const dbPath = path.join(app.getPath("userData"), "library.sqlite3");
    db = new Database(dbPath);
    db.pragma("journal_mode = WAL");        // Write-Ahead Logging for concurrent reads
    db.pragma("foreign_keys = ON");
    initSchema(db);
  }
  return db;
}

export function closeLibraryDb(): void {
  db?.close();
  db = null;
}

function initSchema(db: Database.Database): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS library_meta (
      key   TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS tracks (
      id                TEXT PRIMARY KEY,
      filePath          TEXT NOT NULL UNIQUE,
      fileHash          TEXT,
      fileSize          INTEGER NOT NULL,
      modifiedAt        TEXT NOT NULL,
      scannedAt         TEXT NOT NULL,
      artist            TEXT,
      album             TEXT,
      title             TEXT,
      year              INTEGER,
      trackNumber       INTEGER,
      format            TEXT NOT NULL,
      bitrate           INTEGER,
      sampleRate        INTEGER,
      bitDepth          INTEGER,
      duration          REAL,
      artistConfidence  TEXT NOT NULL DEFAULT 'high',
      albumConfidence   TEXT NOT NULL DEFAULT 'high',
      titleConfidence   TEXT NOT NULL DEFAULT 'high',
      yearConfidence    TEXT NOT NULL DEFAULT 'high',
      trackConfidence   TEXT NOT NULL DEFAULT 'high',
      syncedAt          TEXT,
      syncHash          TEXT
    );
    CREATE INDEX IF NOT EXISTS idx_tracks_album ON tracks(album);
    CREATE INDEX IF NOT EXISTS idx_tracks_synced ON tracks(syncedAt);
  `);
}
```

### Pattern 2: Async Scanner with IPC Throttle
**What:** Walk filesystem, extract metadata, insert into SQLite, emit throttled progress.
**When to use:** Full and incremental scans.
**Example:**
```typescript
// Source: Project TransferProgressEvent pattern + Node.js fs API
import { readdir, stat } from "node:fs/promises";
import path from "node:path";

const SCANNABLE_EXTENSIONS = new Set([".flac", ".wav", ".aiff"]);
const IPC_THROTTLE_MS = 50;

export interface ScanProgressEvent {
  filesFound: number;
  filesProcessed: number;
  currentPath: string;
  errorCount: number;
}

export async function scanFolder(
  rootPath: string,
  onProgress: (event: ScanProgressEvent) => void,
): Promise<ScanResult> {
  // Phase 1: Discover all audio files (fast — filesystem only)
  const entries = await readdir(rootPath, { recursive: true });
  const audioFiles = entries
    .filter((entry) => SCANNABLE_EXTENSIONS.has(path.extname(entry).toLowerCase()))
    .map((entry) => path.join(rootPath, entry));

  const filesFound = audioFiles.length;
  let filesProcessed = 0;
  let errorCount = 0;
  let lastEmit = 0;
  const errors: Array<{ filePath: string; reason: string }> = [];

  // Phase 2: Process each file
  for (const filePath of audioFiles) {
    try {
      await processFile(filePath, rootPath);
    } catch (err) {
      errorCount++;
      errors.push({ filePath, reason: err instanceof Error ? err.message : String(err) });
    }

    filesProcessed++;

    // Throttled IPC emission
    const now = Date.now();
    if (now - lastEmit >= IPC_THROTTLE_MS) {
      onProgress({ filesFound, filesProcessed, currentPath: filePath, errorCount });
      lastEmit = now;
      // Yield to event loop
      await new Promise((resolve) => setImmediate(resolve));
    }
  }

  // Final emission
  onProgress({ filesFound, filesProcessed, currentPath: "", errorCount });

  return { filesFound, filesProcessed, errors };
}
```

### Pattern 3: Folder Path Inference
**What:** Extract metadata from relative file path when tags are missing.
**When to use:** After music-metadata extraction, for any field that is null/empty.
**Example:**
```typescript
// Source: D-04 from CONTEXT.md — 5 declared patterns
interface InferredMetadata {
  artist?: string;
  album?: string;
  year?: number;
  trackNumber?: number;
  title?: string;
}

const PATTERNS = [
  // 1. Artist/Album (Year)/NN - Title.ext
  /^(?<artist>[^/]+)\/(?<album>[^/]+?)\s*\((?<year>\d{4})\)\/(?<track>\d+)\s*-\s*(?<title>.+)\.\w+$/,
  // 2. Artist/Album/NN - Title.ext
  /^(?<artist>[^/]+)\/(?<album>[^/]+)\/(?<track>\d+)\s*-\s*(?<title>.+)\.\w+$/,
  // 3. Artist - Album (Year)/Title.ext
  /^(?<artist>[^/]+?)\s*-\s*(?<album>[^/]+?)\s*\((?<year>\d{4})\)\/(?<title>.+)\.\w+$/,
  // 4. Artist - Album/NN. Title.ext
  /^(?<artist>[^/]+?)\s*-\s*(?<album>[^/]+)\/(?<track>\d+)\.\s*(?<title>.+)\.\w+$/,
  // 5. NN - Title.ext (flat folder)
  /^(?:.*\/)?(?<track>\d+)\s*-\s*(?<title>.+)\.\w+$/,
];

export function inferFromPath(relativePath: string): InferredMetadata | null {
  // Normalize to forward slashes
  const normalized = relativePath.replace(/\\/g, "/");

  for (const pattern of PATTERNS) {
    const match = normalized.match(pattern);
    if (match?.groups) {
      return {
        artist: match.groups.artist?.trim(),
        album: match.groups.album?.trim(),
        year: match.groups.year ? parseInt(match.groups.year, 10) : undefined,
        trackNumber: match.groups.track ? parseInt(match.groups.track, 10) : undefined,
        title: match.groups.title?.trim(),
      };
    }
  }

  return null;
}
```

### Pattern 4: IPC Registration (follows existing ipc.ts pattern)
**What:** Register library IPC handlers alongside existing desktop IPC.
**When to use:** App startup.
**Example:**
```typescript
// Follows pattern from ipc.ts — ipcMain.handle + sendToMainWindow
ipcMain.handle("desktop:select-library-folder", async () => {
  const result = await dialog.showOpenDialog({
    properties: ["openDirectory"],
    title: "Selecionar pasta da biblioteca",
  });
  if (result.canceled) return null;
  return result.filePaths[0] ?? null;
});

ipcMain.handle("desktop:start-scan", async (_event, folderPath: string) => {
  return scanFolder(folderPath, (progress) => {
    sendToMainWindow("desktop:scan-progress", progress);
  });
});

ipcMain.handle("desktop:get-library-tracks", () => {
  const db = getLibraryDb();
  return db.prepare("SELECT * FROM tracks ORDER BY artist, album, trackNumber").all();
});

ipcMain.handle("desktop:get-library-root", () => {
  const db = getLibraryDb();
  const row = db.prepare("SELECT value FROM library_meta WHERE key = 'rootPath'").get();
  return row ? (row as { value: string }).value : null;
});
```

### Anti-Patterns to Avoid
- **Opening SQLite in renderer process:** better-sqlite3 is a native module and must run in the main process. Never import it in renderer code.
- **Blocking the event loop during scan:** Even though better-sqlite3 is synchronous, the scan loop must yield periodically via `setImmediate` to keep IPC and window management responsive.
- **Computing SHA-256 for every file on every scan:** Only compute hash when mtime has changed (incremental scan strategy). SHA-256 of a 100MB FLAC takes ~200ms.
- **Sending IPC per file:** At 5000 files, unthrottled IPC would flood the renderer. The 50ms throttle from D-03 is critical.
- **Using `readdir` without recursive flag and hand-rolling recursion:** `fs.readdir({recursive: true})` is native C++ in Node 22 — faster and simpler than manual recursion.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Audio metadata extraction | Custom ID3/Vorbis/RIFF parsers | `music-metadata` parseFile() | Dozens of tag formats, encoding edge cases, binary parsing. Already in project deps. |
| SQLite database driver | Raw SQL via child_process sqlite3 CLI | `better-sqlite3` | Native bindings, prepared statements, transactions, WAL mode. Production-proven. |
| File hashing | Manual chunk-by-chunk hashing | `computeFileSha256` from ffmpeg-pipeline.ts | Already exists, streaming, tested. Direct reuse. |
| Recursive directory walk | Manual recursive readdir | `fs.readdir({recursive: true})` | Built into Node 22 (Electron 41). C++ implementation, handles symlinks correctly. |

**Key insight:** The only genuinely new code in this phase is (1) the folder inference regex patterns, (2) the scan orchestrator that ties filesystem walk + metadata extraction + SQLite insertion together, and (3) the renderer UI. Everything else is reuse or library calls.

## Common Pitfalls

### Pitfall 1: better-sqlite3 Native Binding Mismatch
**What goes wrong:** App crashes at startup with "Module was compiled against a different Node.js version" or "NODE_MODULE_VERSION mismatch".
**Why it happens:** better-sqlite3 is compiled against system Node.js, but Electron uses a different Node.js ABI version (Electron 41 uses Node 22 / ABI v143).
**How to avoid:** Add `electron-rebuild -f -w better-sqlite3` as postinstall script. Verify the `.node` binary targets the correct ABI before first run.
**Warning signs:** Error containing "NODE_MODULE_VERSION" in Electron console.

### Pitfall 2: music-metadata ESM Import in Electron
**What goes wrong:** `import { parseFile } from 'music-metadata'` fails or returns undefined in Electron main process.
**Why it happens:** music-metadata v8+ is pure ESM. The project already handles this in ffmpeg-pipeline.ts with a dynamic import and type cast.
**How to avoid:** Follow the existing pattern from `probeWithMusicMetadata` in ffmpeg-pipeline.ts — use `await import("music-metadata")` with the type cast. Alternatively, since the project already has music-metadata installed and working, extract the import pattern into a shared utility.
**Warning signs:** "Cannot use import statement outside a module" or "parseFile is not a function".

### Pitfall 3: WAV Files Lacking Metadata Tags
**What goes wrong:** WAV files return empty common tags (no artist, album, title).
**Why it happens:** WAV is a raw audio container. Many WAV files have no embedded metadata — no ID3v2, no RIFF INFO chunks. This is extremely common for vinyl rips.
**How to avoid:** Folder-path inference (D-04) is the primary metadata source for WAV files. The confidence system must handle this gracefully — most WAV fields will be `confidence: 'low'`.
**Warning signs:** All WAV files showing empty metadata in the library view.

### Pitfall 4: Large Library Scan Freezing the UI
**What goes wrong:** Scanning 5000+ files blocks the Electron main process, making the window unresponsive.
**Why it happens:** `music-metadata.parseFile()` does I/O for each file. Without yielding, 5000 sequential calls take 30-60 seconds of blocking.
**How to avoid:** Insert `await new Promise(resolve => setImmediate(resolve))` every N files (e.g., every 10 files) or after each file. The 50ms IPC throttle naturally creates yield points.
**Warning signs:** Window becomes unresponsive (Windows "Not Responding" title bar).

### Pitfall 5: Path Separator Issues on Windows
**What goes wrong:** Folder inference regex patterns fail because Windows uses backslashes.
**Why it happens:** `fs.readdir({recursive: true})` returns paths with OS-native separators. Regex patterns use forward slashes.
**How to avoid:** Normalize all paths to forward slashes before running regex patterns: `relativePath.replace(/\\/g, "/")`.
**Warning signs:** All folder inference returning null on Windows despite correct folder structure.

### Pitfall 6: electron-vite Bundling better-sqlite3
**What goes wrong:** Vite tries to bundle the `.node` binary and fails at build time.
**Why it happens:** Vite/Rollup cannot process native C++ addons.
**How to avoid:** The project already uses `externalizeDepsPlugin()` in electron.vite.config.ts for the main process, which externalizes ALL dependencies. better-sqlite3 will be automatically externalized. No additional config needed.
**Warning signs:** Build errors mentioning `.node` files or "Cannot bundle native module".

## Code Examples

### music-metadata Full Tag Extraction
```typescript
// Source: music-metadata GitHub README + existing ffmpeg-pipeline.ts pattern
import type { IAudioMetadata } from "music-metadata";

interface ExtractedTags {
  artist: string | null;
  album: string | null;
  title: string | null;
  year: number | null;
  trackNumber: number | null;
  format: string;
  bitrate: number;
  sampleRate: number;
  bitDepth: number | null;
  duration: number;
}

export async function extractTags(filePath: string): Promise<ExtractedTags> {
  const mm = await import("music-metadata");
  const metadata: IAudioMetadata = await mm.parseFile(filePath);

  return {
    artist: metadata.common.artist ?? null,
    album: metadata.common.album ?? null,
    title: metadata.common.title ?? null,
    year: metadata.common.year ?? null,
    trackNumber: metadata.common.track?.no ?? null,
    format: metadata.format.codec ?? metadata.format.container ?? "unknown",
    bitrate: metadata.format.bitrate ?? 0,
    sampleRate: metadata.format.sampleRate ?? 0,
    bitDepth: metadata.format.bitsPerSample ?? null,
    duration: metadata.format.duration ?? 0,
  };
}
```

### better-sqlite3 Batch Insert with Transaction
```typescript
// Source: better-sqlite3 docs — transactions for bulk inserts
import Database from "better-sqlite3";

export function insertTracks(db: Database.Database, tracks: TrackRow[]): void {
  const insert = db.prepare(`
    INSERT OR REPLACE INTO tracks (
      id, filePath, fileHash, fileSize, modifiedAt, scannedAt,
      artist, album, title, year, trackNumber,
      format, bitrate, sampleRate, bitDepth, duration,
      artistConfidence, albumConfidence, titleConfidence, yearConfidence, trackConfidence
    ) VALUES (
      @id, @filePath, @fileHash, @fileSize, @modifiedAt, @scannedAt,
      @artist, @album, @title, @year, @trackNumber,
      @format, @bitrate, @sampleRate, @bitDepth, @duration,
      @artistConfidence, @albumConfidence, @titleConfidence, @yearConfidence, @trackConfidence
    )
  `);

  const insertMany = db.transaction((rows: TrackRow[]) => {
    for (const row of rows) {
      insert.run(row);
    }
  });

  // Batch in chunks of 100 for memory efficiency
  for (let i = 0; i < tracks.length; i += 100) {
    insertMany(tracks.slice(i, i + 100));
  }
}
```

### Incremental Scan (mtime comparison)
```typescript
// Source: D-06 from CONTEXT.md
import { stat } from "node:fs/promises";
import Database from "better-sqlite3";

interface IndexedFile {
  filePath: string;
  modifiedAt: string;
  fileHash: string | null;
}

export async function getChangedFiles(
  db: Database.Database,
  audioFiles: string[],
): Promise<{ added: string[]; changed: string[]; removed: string[] }> {
  const indexed = new Map<string, IndexedFile>();
  const rows = db.prepare("SELECT filePath, modifiedAt, fileHash FROM tracks").all() as IndexedFile[];
  for (const row of rows) {
    indexed.set(row.filePath, row);
  }

  const currentPaths = new Set(audioFiles);
  const added: string[] = [];
  const changed: string[] = [];
  const removed: string[] = [];

  for (const filePath of audioFiles) {
    const existing = indexed.get(filePath);
    if (!existing) {
      added.push(filePath);
      continue;
    }

    const fileStat = await stat(filePath);
    const mtime = fileStat.mtime.toISOString();
    if (mtime !== existing.modifiedAt) {
      changed.push(filePath);
    }
  }

  for (const [indexedPath] of indexed) {
    if (!currentPaths.has(indexedPath)) {
      removed.push(indexedPath);
    }
  }

  return { added, changed, removed };
}
```

### Preload Bridge Extension
```typescript
// Source: existing trade.ts preload pattern
// Add to the desktopBridge object in trade.ts (or separate library.ts preload)

// In ipc-types.ts — new interfaces:
export interface ScanProgressEvent {
  filesFound: number;
  filesProcessed: number;
  currentPath: string;
  errorCount: number;
}

export interface ScanResult {
  filesFound: number;
  filesProcessed: number;
  errors: Array<{ filePath: string; reason: string }>;
}

export interface LibraryTrack {
  id: string;
  filePath: string;
  artist: string | null;
  album: string | null;
  title: string | null;
  year: number | null;
  trackNumber: number | null;
  format: string;
  bitrate: number;
  sampleRate: number;
  bitDepth: number | null;
  duration: number;
  artistConfidence: "high" | "low";
  albumConfidence: "high" | "low";
  titleConfidence: "high" | "low";
  yearConfidence: "high" | "low";
  trackConfidence: "high" | "low";
}

export interface DesktopBridgeLibrary {
  selectLibraryFolder(): Promise<string | null>;
  startScan(folderPath: string): Promise<ScanResult>;
  getLibraryTracks(): Promise<LibraryTrack[]>;
  getLibraryRoot(): Promise<string | null>;
  startIncrementalScan(): Promise<ScanResult>;
  startFullScan(): Promise<ScanResult>;
  onScanProgress(listener: (event: ScanProgressEvent) => void): () => void;
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Manual recursive readdir | `fs.readdir({recursive: true})` | Node 18.17 (2023) | No external deps for directory walking |
| music-metadata CJS | music-metadata pure ESM (v8+) | 2023 | Requires dynamic import in CJS contexts (already handled in project) |
| electron-rebuild (community) | @electron/rebuild (official) | 2023 | Official Electron org package, same functionality |
| WAL mode opt-in | WAL mode still opt-in | Current | Must explicitly set `PRAGMA journal_mode = WAL` — critical for concurrent read performance |

## Open Questions

1. **Worker thread vs main process for scan**
   - What we know: better-sqlite3 works fine in main process for 5000-10000 files. `music-metadata.parseFile` is async I/O-bound, not CPU-bound.
   - What's unclear: Whether very large libraries (20K+ files) cause noticeable UI jank even with setImmediate yields.
   - Recommendation: Start with async main process + yields. Add worker thread only if real-world testing shows jank. This is Claude's discretion per CONTEXT.md.

2. **music-metadata import pattern**
   - What we know: The existing `probeWithMusicMetadata` in ffmpeg-pipeline.ts uses dynamic import with type cast.
   - What's unclear: Whether extracting this into a shared utility is cleaner than duplicating the pattern.
   - Recommendation: Create a shared `parseAudioFile` utility in `library/metadata-parser.ts` that wraps the dynamic import once and exposes the full tag set.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Electron | Desktop app runtime | Yes | 41.1.0 (in devDeps) | -- |
| Node.js (via Electron) | fs.readdir recursive, crypto | Yes | 22.x (bundled with Electron 41) | -- |
| music-metadata | Tag extraction | Yes | 10.x (in deps) | -- |
| better-sqlite3 | Index storage | No (new dep) | 12.9.0 (to install) | -- |
| @electron/rebuild | Native module rebuild | No (new dep) | 4.0.3 (to install) | -- |
| @types/better-sqlite3 | TypeScript types | No (new dep) | latest (to install) | -- |

**Missing dependencies with no fallback:**
- better-sqlite3, @electron/rebuild, @types/better-sqlite3 — must be installed as first task

**Missing dependencies with fallback:**
- None

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest 3.x |
| Config file | Inherits from electron-vite (no separate vitest.config) |
| Quick run command | `cd apps/desktop && pnpm test` |
| Full suite command | `cd apps/desktop && pnpm test` |

### Phase Requirements -> Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| SCAN-01 | Folder selection via dialog returns path | unit (mock dialog) | `pnpm test -- --run src/main/library/library-ipc.test.ts` | No — Wave 0 |
| SCAN-02 | Recursive scan discovers FLAC/WAV/AIFF files and emits progress | unit | `pnpm test -- --run src/main/library/scanner.test.ts` | No — Wave 0 |
| SCAN-03 | Metadata extraction returns artist, album, title, year, trackNumber, format, bitrate, duration, sampleRate, bitDepth | unit (mock music-metadata) | `pnpm test -- --run src/main/library/metadata-parser.test.ts` | No — Wave 0 |
| SCAN-04 | Folder inference regex matches all 5 patterns | unit (pure function) | `pnpm test -- --run src/main/library/folder-inference.test.ts` | No — Wave 0 |

### Sampling Rate
- **Per task commit:** `cd apps/desktop && pnpm test`
- **Per wave merge:** `cd apps/desktop && pnpm test`
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps
- [ ] `src/main/library/scanner.test.ts` — covers SCAN-02 (filesystem walk, progress throttle, error skip)
- [ ] `src/main/library/metadata-parser.test.ts` — covers SCAN-03 (tag extraction, format mapping)
- [ ] `src/main/library/folder-inference.test.ts` — covers SCAN-04 (all 5 regex patterns, edge cases)
- [ ] `src/main/library/db.test.ts` — covers schema creation, CRUD, incremental scan queries

## Project Constraints (from CLAUDE.md)

- **Solo developer** — architecture must favor simplicity, no over-engineering
- **Electron desktop app** — native module handling required (electron-rebuild)
- **music-metadata already installed** — reuse existing dependency, follow established import pattern
- **Vitest for testing** — follow existing test patterns from ffmpeg-pipeline.test.ts
- **electron-vite for build** — externalizeDepsPlugin already handles native module externalization
- **Tailwind CSS v4 for styling** — renderer uses `@import "tailwindcss"` with hand-rolled components
- **TypeScript strict** — all files must be .ts/.tsx
- **Biome for lint/format** — single tool replaces ESLint + Prettier

## Sources

### Primary (HIGH confidence)
- [better-sqlite3 npm](https://www.npmjs.com/package/better-sqlite3) — version 12.9.0 verified
- [music-metadata GitHub](https://github.com/Borewit/music-metadata) — common tags, format properties, parseFile API
- [music-metadata common_metadata.md](https://github.com/borewit/music-metadata/blob/master/doc/common_metadata.md) — full tag list
- [electron-vite C/C++ Addons guide](https://electron-vite.github.io/guide/cpp-addons.html) — native module externalization
- Project source: `apps/desktop/src/main/audio/ffmpeg-pipeline.ts` — existing music-metadata and SHA-256 patterns
- Project source: `apps/desktop/src/shared/ipc-types.ts` — IPC type definitions, bridge interfaces
- Project source: `apps/desktop/src/main/ipc.ts` — dialog.showOpenDialog, IPC registration patterns
- Project source: `apps/desktop/electron.vite.config.ts` — externalizeDepsPlugin configuration

### Secondary (MEDIUM confidence)
- [better-sqlite3 worker threads docs](https://github.com/WiseLibs/better-sqlite3/blob/master/docs/threads.md) — threading strategy guidance
- [Electron-rebuild integration guide](https://dev.to/arindam1997007/a-step-by-step-guide-to-integrating-better-sqlite3-with-electron-js-app-using-create-react-app-3k16) — postinstall setup
- [Scaling SQLite with worker threads](https://dev.to/lovestaco/scaling-sqlite-with-node-worker-threads-and-better-sqlite3-4189) — performance considerations

### Tertiary (LOW confidence)
- None

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — better-sqlite3 is the de facto SQLite library for Node/Electron, music-metadata already in project
- Architecture: HIGH — follows existing IPC, preload bridge, and event patterns established in trade runtime
- Pitfalls: HIGH — native binding issues and ESM imports are well-documented, project already solves the ESM pattern

**Research date:** 2026-04-14
**Valid until:** 2026-05-14 (stable domain, 30-day validity)
