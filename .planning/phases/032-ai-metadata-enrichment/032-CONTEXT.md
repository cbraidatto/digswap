# Phase 32: AI Metadata Enrichment - Context

**Gathered:** 2026-04-15
**Status:** Ready for planning

<domain>
## Phase Boundary

Poorly-tagged audio files get AI-inferred metadata via Gemini Flash API, with confidence scoring and user override protection. The enrichment runs on demand (user-triggered), not automatically on scan.

Surfaces in scope:
- Gemini Flash API integration for metadata inference (artist, album, title, year, track number)
- "Enrich metadata" button in library view to trigger inference on poorly-tagged files
- Confidence level 'ai' added to existing MetadataConfidence type
- Per-field userEdited flags in SQLite to protect manual corrections
- Inline editing of AI-inferred fields in library view with AI badge indicator
- Progress feedback during inference batch

Out of scope:
- Automatic inference on scan (user chose on-demand only)
- Audio fingerprinting (Shazam-style recognition)
- Discogs matching from AI-inferred metadata (future phase)
- Batch review/approve screen (inline editing covers this)

</domain>

<decisions>
## Implementation Decisions

### D-01: Trigger Strategy — On-Demand Only
- Inference runs ONLY when user clicks an "Enrich metadata" button
- NOT automatic after scan — user controls when AI runs and when API quota is consumed
- Button in library view triggers batch inference on all qualifying tracks
- Qualifying = any track with at least one null field (artist, album, title, or year)

### D-02: Poorly-Tagged Threshold — Any Field Null
- A track qualifies for AI inference if ANY of these fields is null: artist, album, title, year
- This is broader than "missing artist OR title" — catches partial metadata gaps too
- Tracks with all fields populated (even from folder-inference) are NOT sent to AI

### D-03: Confidence Model — Add 'ai' as Third Level
- MetadataConfidence expands from `'high' | 'low'` to `'high' | 'low' | 'ai'`
- `high` = from embedded audio tags (existing)
- `low` = from folder/filename inference (existing)
- `ai` = from Gemini Flash inference (new)
- Existing UI already displays confidence indicators — extend for 'ai' level
- AI confidence is ABOVE 'low' (folder inference) but BELOW 'high' (tags)

### D-04: User Correction Protection — Per-Field userEdited Flags
- Add boolean columns to SQLite tracks table: `artistUserEdited`, `albumUserEdited`, `titleUserEdited`, `yearUserEdited`, `trackUserEdited`
- Default: false (0)
- When user manually edits a field, set corresponding flag to true (1)
- AI re-inference SKIPS any field where `*UserEdited = true`
- This is granular: user can edit artist but let AI re-infer album
- Manual edit also sets confidence to 'high' for that field

### D-05: UX — Inline Editing with AI Badge
- Fields inferred by AI show a visual badge/icon (e.g., sparkle icon) in the library list/album view
- Clicking an AI-inferred field opens inline editing (same pattern as existing library view)
- After user edits, badge disappears and field gets `userEdited = true` + confidence = 'high'
- No separate review screen — all editing happens inline in the existing library views

### Claude's Discretion
- Gemini Flash model version and API configuration (temperature, prompt design)
- Batch size for inference requests (how many tracks per API call)
- Progress UI pattern (progress bar vs inline status per track)
- Whether to send filename/folder path as additional context to Gemini
- Rate limiting / retry strategy for Gemini API calls
- Inline edit component implementation (contenteditable, input, popover)

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Existing Metadata System
- `apps/desktop/src/main/library/metadata-parser.ts` — Current metadata extraction with confidence scoring (high/low)
- `apps/desktop/src/main/library/folder-inference.ts` — Folder/filename inference for missing tags
- `apps/desktop/src/main/library/db.ts` — SQLite schema with tracks table and *Confidence columns
- `apps/desktop/src/main/library/scanner.ts` — Scan pipeline that calls extractTrackMetadata

### Library UI
- `apps/desktop/src/renderer/src/LibraryListView.tsx` — List view with MetadataConfidence display
- `apps/desktop/src/renderer/src/LibraryAlbumView.tsx` — Album view with MetadataConfidence display
- `apps/desktop/src/renderer/src/LibraryScreen.tsx` — Library screen container

### IPC Layer
- `apps/desktop/src/shared/ipc-types.ts` — Desktop bridge types, MetadataConfidence type location
- `apps/desktop/src/main/library/library-ipc.ts` — Library IPC handlers pattern
- `apps/desktop/src/preload/main.ts` — Preload bridge exposure pattern

### Prior Phase Context
- `.planning/phases/031-tray-daemon-file-watcher/031-CONTEXT.md` — Phase 31 decisions (watcher, tray)

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `metadata-parser.ts`: `extractTrackMetadata()` — already handles confidence assignment, extend for AI source
- `folder-inference.ts`: `inferFromPath()` — provides partial metadata from file paths (used as AI input context)
- `db.ts`: `insertTracks()` — INSERT OR REPLACE pattern for updating tracks with new metadata
- `library-ipc.ts`: IPC handler registration pattern — follow for new AI inference handlers
- `LibraryListView.tsx` / `LibraryAlbumView.tsx`: Already render confidence indicators — extend for 'ai' level

### Established Patterns
- Dynamic ESM import for heavy modules (`await import("music-metadata")` pattern in metadata-parser.ts)
- IPC handler pattern: `ipcMain.handle("desktop:channel-name", handler)` in library-ipc.ts
- Preload bridge: methods exposed on `window.desktopBridge` via `contextBridge.exposeInMainWorld`
- SQLite transactions: batched inserts in groups of 100 via `database.transaction()`

### Integration Points
- New IPC channel `desktop:enrich-metadata` triggers inference from renderer
- New IPC channel `desktop:update-track-metadata` for manual edits (sets userEdited flags)
- Gemini API key via environment variable or Electron safeStorage
- Progress events via `webContents.send("desktop:enrich-progress", ...)`

</code_context>

<specifics>
## Specific Ideas

No specific requirements — open to standard approaches for Gemini Flash integration and inline editing UX.

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 032-ai-metadata-enrichment*
*Context gathered: 2026-04-15*
