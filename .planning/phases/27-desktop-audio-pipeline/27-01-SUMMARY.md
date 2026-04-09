---
phase: 27-desktop-audio-pipeline
plan: 01
subsystem: audio
tags: [ffmpeg, music-metadata, sha256, audio-pipeline, electron, vitest, tdd]

# Dependency graph
requires:
  - phase: 17-desktop-trade-runtime
    provides: "Electron main process structure, chunked-transfer SHA-256 pattern"
provides:
  - "extractSpecs: ffprobe + music-metadata fallback for audio metadata extraction"
  - "generatePreview: 2-minute stream-copy preview with random offset"
  - "computeFileSha256: streaming SHA-256 hash computation"
  - "AudioPipelineError: typed error class with FILE_TOO_SHORT, PROBE_FAILED, FFMPEG_FAILED codes"
affects: [27-desktop-audio-pipeline, trade-flow, desktop-p2p]

# Tech tracking
tech-stack:
  added: [ffmpeg-static@5.3.0, music-metadata@10.9.1, vitest@3.2.4 (desktop)]
  patterns: [vi.mock for ESM node:child_process, parseFile Node-only export cast, execFile callback-based promisify for mockability]

key-files:
  created:
    - apps/desktop/src/main/audio/ffmpeg-pipeline.ts
    - apps/desktop/src/main/audio/ffmpeg-pipeline.test.ts
    - apps/desktop/vitest.config.ts
  modified:
    - apps/desktop/package.json
    - package.json

key-decisions:
  - "vi.mock at module level for node:child_process instead of vi.spyOn (ESM immutable exports)"
  - "music-metadata parseFile accessed via dynamic import with type cast (Node-only export not in default types)"
  - "execFile wrapped in per-call promise instead of promisify-at-import to preserve vi.mock interceptability"
  - "onlyBuiltDependencies added to root package.json for ffmpeg-static binary download"

patterns-established:
  - "vi.mock factory pattern for node:child_process in Electron main process tests"
  - "Type-safe cast for music-metadata Node-only parseFile export"
  - "AudioPipelineError code discriminant pattern for typed error handling"

requirements-completed: [TRD-07, TRD-08, TRD-09]

# Metrics
duration: 8min
completed: 2026-04-09
---

# Phase 27 Plan 01: FFmpeg Audio Pipeline Summary

**TDD-driven FFmpeg pipeline for audio spec extraction, 2-minute stream-copy preview generation, and SHA-256 file hashing in the Electron main process**

## Performance

- **Duration:** 8 min
- **Started:** 2026-04-09T17:53:50Z
- **Completed:** 2026-04-09T18:02:03Z
- **Tasks:** 3 (RED, GREEN, REFACTOR)
- **Files modified:** 5

## Accomplishments
- Full TDD cycle: 12 failing tests written first, then implementation, then TypeScript/mock refactor
- extractSpecs probes audio files with ffprobe, falls back to music-metadata, enforces 120s minimum duration
- generatePreview cuts 2-minute clips with -c copy (zero transcoding), random offset between 10-80% of track
- computeFileSha256 streams file through SHA-256 hash, matching existing chunked-transfer.ts pattern
- AudioPipelineError class with typed code discriminant for structured error handling
- vitest configured for the desktop workspace with path aliases

## Task Commits

Each task was committed atomically:

1. **RED: Failing tests** - `26de6e7` (test)
2. **GREEN: Implementation** - `de38335` (feat)
3. **REFACTOR: TypeScript + mock cleanup** - `3430090` (refactor)

## Files Created/Modified
- `apps/desktop/src/main/audio/ffmpeg-pipeline.ts` - Core audio pipeline: extractSpecs, generatePreview, computeFileSha256, AudioPipelineError
- `apps/desktop/src/main/audio/ffmpeg-pipeline.test.ts` - 12 unit tests covering all pipeline behaviors
- `apps/desktop/vitest.config.ts` - Vitest configuration for desktop workspace
- `apps/desktop/package.json` - Added ffmpeg-static, music-metadata, vitest dependencies
- `package.json` - Added onlyBuiltDependencies for ffmpeg-static binary download

## Decisions Made
- Used vi.mock factory pattern at module level for node:child_process since ESM exports are immutable (vi.spyOn fails)
- music-metadata parseFile is Node-only export not present in default type declarations; used dynamic import with explicit type cast
- Wrapped execFile in a per-call promise function (not promisify at module load) to preserve vi.mock interceptability
- Added onlyBuiltDependencies to root package.json pnpm config to allow ffmpeg-static install script to run

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] ESM module spy limitation**
- **Found during:** GREEN phase (initial test run)
- **Issue:** vi.spyOn cannot spy on ESM module exports (node:child_process) -- TypeError: Cannot redefine property
- **Fix:** Rewrote tests to use vi.mock factory pattern at module level instead of per-test vi.spyOn
- **Files modified:** apps/desktop/src/main/audio/ffmpeg-pipeline.test.ts
- **Verification:** All 12 tests pass
- **Committed in:** 3430090 (refactor commit)

**2. [Rule 3 - Blocking] music-metadata TypeScript type resolution**
- **Found during:** GREEN phase (typecheck)
- **Issue:** music-metadata exports parseFile only from Node entry point (lib/index.d.ts) but TypeScript resolves to default entry (lib/core.d.ts) which lacks it
- **Fix:** Used dynamic import with explicit type cast for parseFile access
- **Files modified:** apps/desktop/src/main/audio/ffmpeg-pipeline.ts
- **Verification:** tsc --noEmit passes clean
- **Committed in:** 3430090 (refactor commit)

**3. [Rule 3 - Blocking] ffmpeg-static build script blocked by pnpm**
- **Found during:** Dependency installation
- **Issue:** pnpm 10.x blocks install scripts by default; ffmpeg-static needs its install script to download the ffmpeg binary
- **Fix:** Added onlyBuiltDependencies: ["ffmpeg-static", "esbuild"] to root package.json pnpm config
- **Files modified:** package.json
- **Verification:** ffmpeg binary available at node_modules path
- **Committed in:** 26de6e7 (test commit, part of dependency setup)

---

**Total deviations:** 3 auto-fixed (3 blocking issues)
**Impact on plan:** All fixes necessary for toolchain compatibility. No scope creep.

## Issues Encountered
None beyond the auto-fixed deviations above.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- FFmpeg pipeline ready for integration into trade-runtime's multi-item transfer flow
- extractSpecs and generatePreview can be called from IPC handlers in the desktop main process
- computeFileSha256 provides independent hash verification alongside existing chunked-transfer.ts pattern

## Self-Check: PASSED

All 4 created files verified present. All 3 commit hashes verified in git log.

---
*Phase: 27-desktop-audio-pipeline*
*Completed: 2026-04-09*
