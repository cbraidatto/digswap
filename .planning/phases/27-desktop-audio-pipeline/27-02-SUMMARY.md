---
phase: 27-desktop-audio-pipeline
plan: 02
subsystem: audio
tags: [supabase-storage, ipc, electron, sha256, upload-pipeline, preview, trade-flow]

# Dependency graph
requires:
  - phase: 27-desktop-audio-pipeline
    plan: 01
    provides: "extractSpecs, generatePreview, computeFileSha256 from ffmpeg-pipeline.ts"
  - phase: 17-desktop-trade-runtime
    provides: "IPC registration patterns, preload bridge, DesktopBridgeTradeRuntime interface"
provides:
  - "uploadPreviewToStorage: uploads preview audio to Supabase Storage bucket 'trade-previews'"
  - "runAudioUploadPipeline: orchestrates spec extraction, SHA-256 hash, immutable DB write, preview generation, and Storage upload"
  - "selectAndPrepareAudio IPC handler: file picker, auth check, full pipeline execution from renderer"
  - "AudioPrepResult type: renderer-accessible result of audio preparation"
affects: [27-desktop-audio-pipeline, trade-flow, desktop-p2p, proposal-builder]

# Tech tracking
tech-stack:
  added: []
  patterns: [Supabase Storage first-write-wins upload, SHA-256 immutable DB write via .is('file_hash' null) guard, IPC handler with dialog.showOpenDialog + auth gate]

key-files:
  created:
    - apps/desktop/src/main/audio/preview-uploader.ts
    - apps/desktop/src/main/audio/upload-pipeline.ts
  modified:
    - apps/desktop/src/shared/ipc-types.ts
    - apps/desktop/src/main/ipc.ts
    - apps/desktop/src/preload/trade.ts
    - apps/desktop/src/preload/index.ts

key-decisions:
  - "Supabase Storage upsert:false for first-write-wins semantics on preview uploads"
  - "SHA-256 immutability via .is('file_hash', null) guard -- second calls become no-ops, not errors"
  - "AudioPrepResult duplicated in ipc-types.ts (not imported from upload-pipeline) for clean renderer boundary"
  - "IPC handler throws on cancelled file picker (renderer handles gracefully)"
  - "Both preload scripts (index.ts and trade.ts) updated to satisfy DesktopBridgeTradeRuntime contract"

patterns-established:
  - "Upload pipeline orchestration: spec extract -> hash -> DB write -> preview gen -> upload -> cleanup"
  - "Immutable DB field write via .is(column, null) guard with Supabase client"
  - "IPC handler pattern: dialog -> auth check -> pipeline -> return serializable result"

requirements-completed: [TRD-10, TRD-13]

# Metrics
duration: 4min
completed: 2026-04-09
---

# Phase 27 Plan 02: Audio Upload Pipeline + IPC Wiring Summary

**Supabase Storage preview uploader, SHA-256 immutable DB write, and selectAndPrepareAudio IPC handler wiring the FFmpeg pipeline to the renderer trade flow**

## Performance

- **Duration:** 4 min
- **Started:** 2026-04-09T18:06:05Z
- **Completed:** 2026-04-09T18:10:22Z
- **Tasks:** 2
- **Files modified:** 6

## Accomplishments
- Preview uploader with first-write-wins semantics on Supabase Storage bucket 'trade-previews'
- Upload pipeline orchestrator connecting 27-01's FFmpeg pipeline to Supabase: spec extraction, SHA-256 hash, immutable DB write, preview generation, and Storage upload
- selectAndPrepareAudio IPC handler: native file picker dialog, auth gate, full pipeline execution, JSON-serializable result to renderer
- AudioPrepResult type exposed to renderer via ipc-types.ts without cross-boundary imports

## Task Commits

Each task was committed atomically:

1. **Task 1: Supabase Storage uploader + upload pipeline orchestrator** - `ac0f1da` (feat)
2. **Task 2: Extend IPC types + wire selectAndPrepareAudio handler** - `b7341be` (feat)

## Files Created/Modified
- `apps/desktop/src/main/audio/preview-uploader.ts` - Uploads preview file to Supabase Storage with first-write-wins (upsert:false)
- `apps/desktop/src/main/audio/upload-pipeline.ts` - Orchestrates full audio prep pipeline: extractSpecs, computeFileSha256, DB write, generatePreview, uploadPreviewToStorage, cleanup
- `apps/desktop/src/shared/ipc-types.ts` - Added AudioPrepResult interface and selectAndPrepareAudio to DesktopBridgeTradeRuntime
- `apps/desktop/src/main/ipc.ts` - IPC handler for selectAndPrepareAudio with file picker, auth check, pipeline call
- `apps/desktop/src/preload/trade.ts` - Bridge method for selectAndPrepareAudio via ipcRenderer.invoke
- `apps/desktop/src/preload/index.ts` - Bridge method for selectAndPrepareAudio via ipcRenderer.invoke

## Decisions Made
- Used upsert:false on Supabase Storage upload -- duplicate uploads are a caller bug, not an expected retry pattern
- SHA-256 immutability uses `.is('file_hash', null)` on the update query so a second pipeline call for the same item quietly skips the DB write instead of erroring
- AudioPrepResult type is duplicated in ipc-types.ts rather than imported from upload-pipeline.ts to keep the renderer/main boundary clean
- IPC handler throws on cancelled file picker (UserCancelledPickerError equivalent) -- renderer is expected to catch and handle gracefully
- Both preload scripts (index.ts and trade.ts) required the new method to satisfy the DesktopBridgeTradeRuntime type contract

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Both preload scripts need selectAndPrepareAudio**
- **Found during:** Task 2 (tsc verification)
- **Issue:** The plan only mentioned trade.ts preload, but index.ts contains an identical bridge definition that also implements DesktopBridge & DesktopBridgeTradeRuntime. tsc failed with missing property error.
- **Fix:** Added selectAndPrepareAudio and AudioPrepResult import to both preload/index.ts and preload/trade.ts
- **Files modified:** apps/desktop/src/preload/index.ts
- **Verification:** tsc --noEmit passes with zero errors
- **Committed in:** b7341be (Task 2 commit)

---

**Total deviations:** 1 auto-fixed (1 blocking issue)
**Impact on plan:** Necessary to maintain type contract consistency across both preload entry points. No scope creep.

## Issues Encountered
None beyond the auto-fixed deviation above.

## User Setup Required
None - no external service configuration required. Supabase Storage bucket 'trade-previews' must exist in the project's Supabase instance (expected to be created via migration).

## Known Stubs
None - all functions are fully implemented with real Supabase client calls.

## Next Phase Readiness
- selectAndPrepareAudio IPC is ready for the renderer ProposalBuilder to call
- Preview files are uploaded to Supabase Storage at the standard path convention
- SHA-256 hash is written immutably to trade_proposal_items for transfer verification
- Ready for 27-03 (spectrogram analysis) and 27-04 (renderer integration)

## Self-Check: PASSED

All created files verified present. Both commit hashes verified in git log.

---
*Phase: 27-desktop-audio-pipeline*
*Completed: 2026-04-09*
