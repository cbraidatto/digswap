# Phase 29: Local Index + Folder Scanner - Context

**Gathered:** 2026-04-14
**Status:** Ready for planning

<domain>
## Phase Boundary

Desktop Electron app scans a user-selected local folder and builds a metadata-rich SQLite index of all lossless audio files. The index serves as the foundation for Phase 30 (Sync Engine) and Phase 32 (AI Metadata Enrichment).

Surfaces in scope:
- "My Library" screen in the desktop AppShell (new screen alongside trades)
- Empty state with folder picker
- Scan progress view (replaces library view during scan)
- Library results view with dual mode (list + album-grouped)
- SQLite-backed index with metadata extraction and folder-path inference

Out of scope:
- Search/filter within the library (future enhancement)
- Multiple library roots (single folder only)
- AI metadata enrichment (Phase 32)
- Sync to web app (Phase 30)
- File watching / daemon (Phase 31)
- DSD formats (dsf/dff — future extension point)

</domain>

<decisions>
## Implementation Decisions

### D-01: Index Storage — SQLite via better-sqlite3
- Local index stored in SQLite database via `better-sqlite3`
- Chosen over electron-store (JSON) for query capability, atomic writes, and Phase 30 sync queries (`SELECT WHERE syncedAt IS NULL`)
- Requires `electron-rebuild` / `@electron/rebuild` for Electron native binding
- Database file location: app userData directory (Electron `app.getPath('userData')`)

### D-02: Supported Formats — Lossless Only (DJ-focused)
- `SCANNABLE_FORMATS = ['flac', 'wav', 'aiff']`
- Strictly lossless, focused on DJ/digger workflows
- No MP3, AAC, WMA, or other lossy formats
- No DSD (dsf/dff) — documented extension point for future

### D-03: Scan Progress UX — Bar + File Ticker
- Determinate progress bar showing `filesProcessed / filesFound` counters
- Single-line file path ticker below the bar showing current file being processed
- Single IPC event type: `ScanProgressEvent { filesFound: number; filesProcessed: number; currentPath: string }`
- Throttle IPC emissions to max every 50ms from main process to avoid renderer saturation
- Follows existing `TransferProgressEvent` pattern from trade runtime

### D-04: Metadata Inference — 5 Folder-Hierarchy Patterns + Confidence Flags
- When audio file tags (ID3v2, Vorbis, FLAC) are missing or incomplete, infer metadata from folder structure and filename
- **Partial fill:** Tags have priority. Only empty fields are filled by inference, marked as `confidence: 'low'`. Fields from tags are `confidence: 'high'`
- Supported patterns (ordered by specificity):
  1. `Artist/Album (Year)/NN - Title.ext` → artist, album, year, track_number, title
  2. `Artist/Album/NN - Title.ext` → artist, album, track_number, title
  3. `Artist - Album (Year)/Title.ext` → artist, album, year, title
  4. `Artist - Album/NN. Title.ext` → artist, album, track_number, title
  5. `NN - Title.ext` (flat folder) → track_number, title only
- Confidence assignment: two-level hierarchy with recognizable track prefix → `high`; filename-only or ambiguous → `low`
- `low` confidence records become Phase 32 AI enrichment candidates

### D-05: Library UI — Dual View, No Search
- Two view modes for library results: flat list and album-grouped
- **List view:** Table with columns — artist, album, title, format, bitrate, duration
- **Album view:** Files grouped by album with album header
- Toggle via icons in upper corner (grid/list icons, like Finder/Explorer)
- No search or filter functionality in this phase
- Inferred metadata fields displayed in a different/muted color to indicate confidence level

### D-06: Re-scan Strategy — Incremental + Full Option
- Default: incremental scan — compares filesystem mtime against stored index
- Only re-processes files where mtime has changed; then re-computes SHA-256 hash for changed files
- Detects new files (not in index) and removed files (in index but not on disk)
- "Full Re-scan" button available to force complete re-index of all files

### D-07: Single Library Root
- One folder root only per user
- Stored in SQLite metadata table or app settings
- User selects via native OS folder picker (`dialog.showOpenDialog` with `openDirectory`)

### D-08: Error Handling — Skip and Summarize
- Scanner skips problematic files (corrupted, permission denied, unreadable) and continues
- Error count shown in progress bar area during scan
- Summary screen at end of scan shows list of all skipped files with error reasons
- Scan never stops due to individual file errors

### D-09: SQLite Schema — Extended Fields
- Core fields per requirements: artist, album, title, year, trackNumber, format, bitrate, duration
- Additional fields: fileSize (bytes), sampleRate (Hz), bitDepth (16/24/32)
- System fields: id (TEXT PK), filePath (TEXT UNIQUE), fileHash (SHA-256), scannedAt, modifiedAt (filesystem mtime)
- Confidence fields: artistConfidence, albumConfidence, titleConfidence, yearConfidence, trackConfidence (enum: 'high' | 'low')
- Sync fields (Phase 30 handoff): syncedAt (NULL = pending), syncHash (hash of synced state, for change detection)

### D-10: Navigation — New Screen in AppShell
- "My Library" as a new screen in the existing desktop AppShell
- Lives alongside the trade screens
- Accessible via AppShell navigation

### D-11: Empty State — Central Button
- First visit shows empty state: icon + text "Select a folder to scan your music library" + large "Choose Folder" button
- Clicking opens native folder picker
- After folder selection, scan starts immediately

### D-12: Scan Progress Replaces Library View
- During scan, the progress view (bar + ticker + counters) replaces the library content area
- When scan completes, results appear in-place (transition to list/album view)
- Error summary shown between scan completion and results display (if errors occurred)

### Claude's Discretion
- Threading strategy for the scan (worker thread vs async main process with yields) — choose based on implementation complexity
- Exact SQLite database file path within userData
- Progress bar visual styling and animation
- Album grouping logic for "Unknown Album" entries
- Exact shade/opacity for inferred metadata color differentiation

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Desktop Architecture
- `apps/desktop/src/shared/ipc-types.ts` — All IPC type definitions, bridge interfaces, event shapes (TransferProgressEvent pattern to follow)
- `apps/desktop/src/main/ipc.ts` — IPC handler registration pattern, dialog.showOpenDialog usage for folder picking
- `apps/desktop/src/main/config.ts` — Desktop config resolution pattern, env parsing
- `apps/desktop/src/main/session-store.ts` — Existing persistence pattern (electron-store for settings)

### Audio Processing
- `apps/desktop/src/main/audio/ffmpeg-pipeline.ts` — extractSpecs, music-metadata usage, AudioSpecs interface, probeWithMusicMetadata pattern
- `apps/desktop/src/main/audio/upload-pipeline.ts` — Audio pipeline orchestration pattern

### Renderer
- `apps/desktop/src/renderer/src/AppShell.tsx` — AppShell where "My Library" screen will be added
- `apps/desktop/src/main/window.ts` — Window management, renderer switching

### Trade Runtime (pattern reference)
- `apps/desktop/src/main/trade-runtime.ts` — Event emitter patterns for progress/state
- `apps/desktop/src/preload/trade.ts` — Preload bridge exposure pattern

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `dialog.showOpenDialog` — already used for download path selection (ipc.ts:130-142) and audio file picking (ipc.ts:190-200). Folder picker is the same API with `openDirectory` property
- `music-metadata` — already imported in ffmpeg-pipeline.ts for audio tag extraction. `probeWithMusicMetadata` function extracts codec, sampleRate, bitrate, duration. Can be extended for full tag reading (artist, album, title, year, track)
- `computeFileSha256` — streaming SHA-256 hash computation already exists in ffmpeg-pipeline.ts:266
- `TransferProgressEvent` / `onTransferProgress` — established IPC event pattern for real-time progress updates from main to renderer

### Established Patterns
- **IPC:** `ipcMain.handle("desktop:channel-name", handler)` in ipc.ts, exposed via preload bridge
- **Events:** EventEmitter pattern in trade-runtime.ts for lobby/transfer state changes
- **Preload:** Bridge interfaces defined in ipc-types.ts, exposed on `window.desktopBridge`
- **Persistence:** electron-store for small/infrequent data (settings, receipts)

### Integration Points
- AppShell.tsx — add "My Library" screen/route
- ipc-types.ts — add ScanProgressEvent, LibraryBridge interfaces
- ipc.ts — register library scan handlers
- preload — expose library bridge methods

</code_context>

<specifics>
## Specific Ideas

- Scanner formats strictly limited to DJ-grade lossless: FLAC, WAV, AIFF only
- Confidence flag system (`high`/`low` per field) creates clean handoff contract for Phase 32 AI enrichment
- `syncedAt` + `syncHash` columns prepare the Phase 30 Sync Engine interface without Phase 30 building anything yet
- Incremental scan uses mtime-first strategy (fast filesystem stat) before expensive hash recomputation

</specifics>

<deferred>
## Deferred Ideas

- **Search/filter in library** — natural next step after basic viewing works. Could be Phase 30+ or backlog
- **Multiple library roots** — support D:\Music + E:\Vinyl Rips as separate roots. Useful for users with external drives
- **DSD format support** (dsf/dff) — extension point for audiophile users. music-metadata supports it but tag coverage is sparse
- **MP3/lossy format support** — excluded by user decision (DJ-focused lossless only) but could be toggled later
- **BPM/key detection** — useful for DJs but computationally heavy, belongs in Phase 32 or separate phase
- **Album art extraction** — music-metadata can extract embedded cover art. Visual enhancement for album-grouped view

</deferred>

---

*Phase: 029-local-index-folder-scanner*
*Context gathered: 2026-04-14*
