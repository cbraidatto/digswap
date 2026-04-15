---
phase: 032-ai-metadata-enrichment
plan: 01
subsystem: desktop-library
tags: [gemini-flash, ai-inference, sqlite, ipc-types, metadata, electron]

requires:
  - phase: 029-local-library-index
    provides: SQLite tracks table, scanner, metadata-parser, library-ipc
  - phase: 031-tray-daemon
    provides: Desktop app lifecycle (introduced ipc-types regression)
provides:
  - Restored ipc-types.ts with all library/audio/trade types (Phase 31 regression fix)
  - MetadataConfidence extended with 'ai' third level
  - LibraryTrack interface with 5 userEdited boolean fields
  - EnrichProgressEvent, EnrichResult types for AI enrichment
  - DesktopBridgeLibrary interface with enrichment + editing IPC methods
  - SQLite schema migration for 5 userEdited INTEGER columns
  - getQualifyingTracks, updateTrackAiMetadata, updateTrackField DB helpers
  - trackRowToLibraryTrack mapper for SQLite integer-to-boolean conversion
  - ai-enrichment.ts service with Gemini Flash batch inference
  - Preload trade.ts wired with sync + AI enrichment IPC methods
affects: [032-02-ai-metadata-enrichment, desktop-library, library-ipc]

tech-stack:
  added: ["@google/genai", "zod"]
  patterns: [gemini-structured-output, batch-inference, user-edit-protection, sqlite-integer-to-boolean-mapper]

key-files:
  created:
    - apps/desktop/src/main/library/ai-enrichment.ts
    - apps/desktop/src/main/library/ai-enrichment.test.ts
  modified:
    - apps/desktop/src/shared/ipc-types.ts
    - apps/desktop/src/main/library/db.ts
    - apps/desktop/src/main/library/library-ipc.ts
    - apps/desktop/src/main/library/scanner.ts
    - apps/desktop/src/preload/trade.ts
    - apps/desktop/src/main/library/sync-manager.test.ts
    - apps/desktop/package.json
    - pnpm-lock.yaml

key-decisions:
  - "Injectable delayMs option on enrichTracks for testability (avoids fake timers complexity)"
  - "trackRowToLibraryTrack used in library-ipc.ts instead of unsafe cast for type-safe IPC boundary"
  - "MultiItemProgressEvent/CompleteEvent shapes match actual codebase usage (not plan spec)"
  - "selectAndPrepareAudio added to DesktopBridgeTradeRuntime (already used in preload but missing from interface)"

patterns-established:
  - "Per-field userEdited protection: integer columns in SQLite, boolean in IPC, AI checks before overwriting"
  - "Gemini structured output via responseJsonSchema with inline JSON schema (not zod.toJSONSchema due to import compatibility)"
  - "Batch inference with configurable inter-batch delay for rate limiting"

metrics:
  duration: 16min
  completed: "2026-04-15T20:57:00Z"
  tasks: 2
  files: 10
---

# Phase 032 Plan 01: AI Enrichment Engine + Type Restoration Summary

Gemini Flash batch inference engine with SQLite userEdited column migration, ipc-types Phase 31 regression fix, and 14 passing unit tests covering AI-01/AI-02/AI-03

## What Was Built

### Task 1: Restore ipc-types.ts and extend for AI enrichment
Restored 10+ types that Phase 31 accidentally removed from ipc-types.ts (MetadataConfidence, ScanProgressEvent, ScanResult, LibraryTrack, SyncResult, SyncProgress, AudioPrepResult, MultiItemProgressEvent, MultiItemCompleteEvent). Extended MetadataConfidence with `"ai"` third level. Added 5 userEdited boolean fields to LibraryTrack. Created EnrichProgressEvent, EnrichResult, and DesktopBridgeLibrary interface with enrichment + editing IPC methods. Wired preload/trade.ts with sync and AI enrichment IPC methods.

### Task 2: Schema migration, AI enrichment service, and unit tests (TDD)
Extended SQLite tracks table with 5 userEdited INTEGER columns via idempotent ALTER TABLE migration. Created AI enrichment functions: getQualifyingTracks (selects tracks with null fields and userEdited=0), updateTrackAiMetadata (writes AI results), updateTrackField (manual edit sets userEdited=1 and confidence='high'), and trackRowToLibraryTrack (integer-to-boolean mapper for IPC boundary). Built ai-enrichment.ts with Gemini Flash batch inference: buildPrompt with file paths and partial tags, applyAiResults respecting userEdited flags, and enrichTracks orchestrator with batch processing, progress callbacks, and per-batch error handling.

## Commits

| Commit | Type | Description |
|--------|------|-------------|
| f509111 | feat | Restore ipc-types library/audio types and extend for AI enrichment |
| c71d68d | test | Add failing tests for AI enrichment service (RED) |
| 39f9059 | feat | Implement AI enrichment service with schema migration and unit tests (GREEN) |
| a90e980 | fix | Resolve TrackRow type mismatches from userEdited column addition |

## Test Results

14 tests passing in `ai-enrichment.test.ts`:
- [AI-01] buildPrompt: 3 tests (file paths, partial tags, inference rules)
- [AI-02] qualifying tracks and userEdited protection: 2 tests
- [AI-03] applyAiResults: 4 tests (skips userEdited, sets 'ai' confidence, leaves existing confidence, handles all-null)
- [AI-01] enrichTracks: 2 tests (batching with progress, error handling with continuation)
- trackRowToLibraryTrack: 3 tests (integer-to-boolean mapping, all-zero, field preservation)

10 tests passing in `sync-manager.test.ts` (unchanged behavior after TrackRow extension).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] library-ipc.ts unsafe TrackRow-to-LibraryTrack cast**
- **Found during:** Task 2 verification
- **Issue:** `getAllTracks(db) as LibraryTrack[]` fails after TrackRow gained integer userEdited fields vs LibraryTrack's boolean fields
- **Fix:** Use `trackRowToLibraryTrack` mapper for type-safe conversion
- **Files modified:** apps/desktop/src/main/library/library-ipc.ts
- **Commit:** a90e980

**2. [Rule 3 - Blocking] scanner.ts missing userEdited fields in TrackRow construction**
- **Found during:** Task 2 verification
- **Issue:** Scanner creates TrackRow objects without the 5 new userEdited fields, causing TS2345
- **Fix:** Added `artistUserEdited: 0` through `trackUserEdited: 0` defaults
- **Files modified:** apps/desktop/src/main/library/scanner.ts
- **Commit:** a90e980

**3. [Rule 3 - Blocking] sync-manager.test.ts makeTrack helper missing userEdited fields**
- **Found during:** Task 2 verification
- **Issue:** Test helper for TrackRow missing the 5 new fields, causing TS2739
- **Fix:** Added userEdited fields with defaults to makeTrack helper
- **Files modified:** apps/desktop/src/main/library/sync-manager.test.ts
- **Commit:** a90e980

**4. [Rule 3 - Blocking] preload/trade.ts missing sync and AI enrichment IPC methods**
- **Found during:** Task 1 verification
- **Issue:** DesktopBridgeLibrary interface now requires startSync, onSyncProgress, and all Phase 32 methods but preload/trade.ts bridge didn't have them, causing TS2322
- **Fix:** Added all missing IPC method implementations to the bridge object
- **Files modified:** apps/desktop/src/preload/trade.ts
- **Commit:** f509111

## Known Stubs

None. All functions are fully implemented. The AI enrichment service will be wired to IPC handlers in Plan 02.

## Self-Check: PASSED
