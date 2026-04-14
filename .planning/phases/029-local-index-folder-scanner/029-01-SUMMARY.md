---
phase: 029-local-index-folder-scanner
plan: 01
subsystem: desktop-library
tags: [sqlite, scanner, metadata, folder-inference, electron]
dependency_graph:
  requires: []
  provides: [library-db, folder-inference, metadata-parser, scan-orchestrator, library-ipc-types]
  affects: [029-02]
tech_stack:
  added: [better-sqlite3, "@types/better-sqlite3", "@electron/rebuild"]
  patterns: [dynamic-esm-import, tdd-red-green, throttled-ipc, batched-sqlite-inserts]
key_files:
  created:
    - apps/desktop/src/main/library/db.ts
    - apps/desktop/src/main/library/folder-inference.ts
    - apps/desktop/src/main/library/folder-inference.test.ts
    - apps/desktop/src/main/library/metadata-parser.ts
    - apps/desktop/src/main/library/metadata-parser.test.ts
    - apps/desktop/src/main/library/scanner.ts
    - apps/desktop/src/main/library/scanner.test.ts
  modified:
    - apps/desktop/package.json
    - apps/desktop/src/shared/ipc-types.ts
decisions:
  - "better-sqlite3 chosen for synchronous SQLite access in Electron main process"
  - "Confidence flags: high for tag-sourced, low for path-inferred, high when both null"
  - "fileHash computed lazily (null on initial scan) to keep scan speed fast"
  - "Path normalization trims whitespace and collapses spaces around separators"
metrics:
  duration: 9min
  completed: "2026-04-14T19:10:24Z"
  tasks_completed: 3
  tasks_total: 3
  tests_added: 19
  files_created: 7
  files_modified: 2
requirements:
  - SCAN-01
  - SCAN-02
  - SCAN-03
  - SCAN-04
---

# Phase 29 Plan 01: Scanner Engine Backend Summary

SQLite database with WAL mode, 5-pattern folder inference, metadata parser merging tags with path inference, and recursive scan orchestrator with throttled IPC progress and incremental support.

## What Was Built

### SQLite Database Module (db.ts)
- `tracks` table with 23 columns including 5 confidence fields, sync tracking columns
- `library_meta` key-value table for settings like root path
- WAL journal mode and foreign keys enabled
- Batched inserts (100 rows per transaction), indexed by album and syncedAt
- CRUD: insertTracks, removeTracksByPaths, getAllTracks, getLibraryRoot, setLibraryRoot, getIndexedFileMtimes

### Folder Inference (folder-inference.ts)
- 5 ordered regex patterns matching common vinyl collection folder structures
- Backslash-to-forward-slash normalization for Windows cross-platform support
- Whitespace trimming on full path and around directory separators
- Returns null for unrecognized structures

### Metadata Parser (metadata-parser.ts)
- Dynamic ESM import of music-metadata (same pattern as ffmpeg-pipeline.ts)
- Merges audio file tags with folder inference; tags always take priority
- Confidence assignment: high (from tags), low (from inference), high (both null)
- Returns complete TrackMetadata with 15 fields

### Scan Orchestrator (scanner.ts)
- Recursive directory scanning filtering .flac, .wav, .aiff extensions
- 50ms-throttled IPC progress events with setImmediate event loop yields
- Batched SQLite inserts (50 tracks per flush)
- Incremental mode: compares filesystem mtime against stored index
- Detects new, modified, and removed files
- Error collection: skips problematic files without stopping scan

### Shared Types (ipc-types.ts)
- MetadataConfidence, ScanProgressEvent, ScanResult, LibraryTrack types
- DesktopBridgeLibrary IPC interface with 7 methods
- Window global augmentation updated

## Commits

| # | Hash | Message |
|---|------|---------|
| 1 | 9973ba9 | feat(029-01): install better-sqlite3 and define library types |
| 2 | 0b81713 | test(029-01): add failing tests for folder-inference and metadata-parser |
| 3 | e443f0c | feat(029-01): implement folder-inference and metadata-parser with passing tests |
| 4 | 179d74f | feat(029-01): build SQLite database module and scan orchestrator with tests |

## Test Results

19 tests passing across 3 test files:
- **folder-inference.test.ts** (8 tests): 5 patterns + backslash normalization + null return + whitespace trimming
- **metadata-parser.test.ts** (5 tests): tag priority, inference fallback, null handling, field completeness, format extraction
- **scanner.test.ts** (6 tests): extension filtering, progress reporting, error collection, incremental new/removed detection, root path setting

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Whitespace around path separators breaks regex matching**
- **Found during:** Task 2
- **Issue:** Paths like `" Artist / Album / Title.flac"` failed all 5 patterns because spaces around `/` were not collapsed
- **Fix:** Added `.trim()` on full path and `.replace(/\s*\/\s*/g, "/")` to normalize spaces around separators
- **Files modified:** apps/desktop/src/main/library/folder-inference.ts

**2. [Rule 1 - Bug] vi.mock factory cannot reference module-scoped variables**
- **Found during:** Task 2
- **Issue:** Vitest hoists vi.mock calls above variable declarations, causing `ReferenceError: Cannot access before initialization`
- **Fix:** Used `vi.hoisted()` to declare mock functions that are available during mock factory execution
- **Files modified:** apps/desktop/src/main/library/metadata-parser.test.ts

**3. [Rule 3 - Blocking] Missing vitest dependency and test script in worktree**
- **Found during:** Task 1
- **Issue:** Worktree package.json lacked vitest devDependency and test/test:watch scripts
- **Fix:** Added vitest ^3.0.0 to devDependencies and test scripts to package.json
- **Files modified:** apps/desktop/package.json

## Known Stubs

None -- all modules are fully functional with real implementations. fileHash is intentionally null on initial scan (documented in plan as "SHA-256 computed lazily").

## Self-Check: PASSED
