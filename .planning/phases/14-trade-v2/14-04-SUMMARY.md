---
phase: 14-trade-v2
plan: "04"
subsystem: p2p
tags: [webrtc, datachannel, preview, sha256, web-worker, canvas, audio, waveform]

# Dependency graph
requires:
  - phase: 14-trade-v2
    provides: "Plan 14-02 proposal form + Plan 14-03 lobby state machine + presence"
provides:
  - "File selection with SHA-256 hashing via Web Worker"
  - "Duration validation rejecting files under 1 minute"
  - "60-second preview generation via Blob.slice"
  - "P2P preview transfer via DataChannel with preview-chunk messages"
  - "Amplitude bars waveform player (PreviewPlayer component)"
  - "Bilateral preview accept/reject server actions"
  - "Transfer gate requiring all 4 bilateral timestamps"
  - "SpectrogramCanvas modal for advanced spectrum analysis"
affects: [14-trade-v2, p2p-transfer, trade-lobby]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Inline Web Worker via URL.createObjectURL(new Blob([workerScript]))"
    - "AudioContext.decodeAudioData for amplitude bucket computation"
    - "Canvas amplitude bars waveform with playback cursor"
    - "Backpressure-aware preview chunk transfer via DataChannel"

key-files:
  created:
    - "src/app/(protected)/trades/[id]/_components/preview-player.tsx"
  modified:
    - "src/app/(protected)/trades/[id]/_components/trade-lobby.tsx"
    - "src/lib/webrtc/chunked-transfer.ts"
    - "src/lib/webrtc/use-peer-connection.ts"
    - "src/actions/trades.ts"

key-decisions:
  - "Inline Web Worker for SHA-256 to avoid separate worker file"
  - "Preview byte estimation uses bitrateKbps * 125 * 65 for safe ~65s overestimate"
  - "PreviewPlayer decodes audio buffer to compute 150 amplitude buckets"
  - "SpectrogramCanvas reused from existing review component for advanced analysis"

patterns-established:
  - "Preview transfer uses distinct preview-chunk/preview-done message types separate from full transfer"
  - "Bilateral timestamp gate: all 4 timestamps non-null before advancing to transferring status"

requirements-completed: [TRADE2-05, TRADE2-06, TRADE2-07, TRADE2-08, TRADE2-09]

# Metrics
duration: 6min
completed: 2026-03-29
---

# Phase 14 Plan 04: Preview Subsystem Summary

**P2P preview pipeline with SHA-256 hashing, Blob.slice preview generation, DataChannel transfer, amplitude waveform player, and bilateral acceptance gating full transfer**

## Performance

- **Duration:** 6 min
- **Started:** 2026-03-29T14:34:24Z
- **Completed:** 2026-03-29T14:40:50Z
- **Tasks:** 5
- **Files modified:** 5

## Accomplishments

- File selection validates audio duration >= 60s and computes SHA-256 hash in Web Worker
- Preview = first ~65s of file bytes via Blob.slice, transferred via DataChannel with backpressure control
- PreviewPlayer renders 150 amplitude bars on canvas with play/pause and real-time cursor animation
- Bilateral preview accept/reject server actions gate full transfer on all 4 timestamps being set
- SpectrogramCanvas modal reused from existing review component for advanced frequency analysis

## Task Commits

Each task was committed atomically:

1. **Task 1: SHA-256 hashing via Web Worker + file validation** - `dedf92e` (feat)
2. **Task 2: Preview generation + P2P transfer via DataChannel** - `ede37fb` (feat)
3. **Task 3: Amplitude bars waveform player component** - `6cc3043` (feat)
4. **Task 4: Bilateral preview accept + transfer start** - `4e537b9` (feat)
5. **Task 5: Preview send/receive progress in lobby UI** - included in `dedf92e` (Task 1)

## Files Created/Modified

- `src/app/(protected)/trades/[id]/_components/preview-player.tsx` - 282-line amplitude bars waveform player with AudioContext decode, canvas rendering, play/pause, and decode error handling
- `src/app/(protected)/trades/[id]/_components/trade-lobby.tsx` - Full preview_selection UI, previewing state with PreviewPlayer, accept/reject controls, spectrum modal, file validation + hash
- `src/lib/webrtc/chunked-transfer.ts` - PreviewChunkMessage and PreviewDoneMessage types added to TransferMessage union
- `src/lib/webrtc/use-peer-connection.ts` - sendPreview function, previewReceived/previewSendProgress/previewReceiveProgress state, preview-chunk/preview-done handlers
- `src/actions/trades.ts` - updateFileHash, acceptPreview, rejectPreview server actions

## Decisions Made

- Used inline Web Worker via `URL.createObjectURL(new Blob([workerScript]))` for SHA-256 computation -- avoids separate worker file, follows D-09 guidance
- Preview byte estimation formula: `Math.min(file.size, bitrateKbps * 125 * 65)` for a safe ~65-second overestimate, per D-03
- PreviewPlayer uses AudioContext.decodeAudioData to compute 150 amplitude buckets from peak sample values
- Reused existing SpectrogramCanvas component from review page for advanced spectrum modal

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed SpectrogramCanvas import path**
- **Found during:** Verification (tsc --noEmit)
- **Issue:** Import path `../../review/_components/spectrogram-canvas` was wrong (goes up too many levels)
- **Fix:** Corrected to `../review/_components/spectrogram-canvas`
- **Files modified:** src/app/(protected)/trades/[id]/_components/trade-lobby.tsx
- **Committed in:** f66b168

---

**Total deviations:** 1 auto-fixed (1 bug)
**Impact on plan:** Minor path correction. No scope creep.

## Issues Encountered

- Pre-existing TS errors in trade-lobby.tsx (line 19: `received-file-store` module not found, line 91: implicit `any` type) are from Plan 14-03 and earlier. The `received-file-store.ts` file exists as untracked in the main repo but was not committed. These are out-of-scope for this plan.

## Known Stubs

None - all functionality is wired end-to-end.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Preview subsystem complete, ready for Plan 14-05 (full transfer + review flow)
- All bilateral timestamps (terms + preview) now gate the transfer phase
- PreviewPlayer and SpectrogramCanvas provide full audio verification before transfer

## Self-Check: PASSED

All 5 created/modified files verified on disk. All 5 commit hashes verified in git log.

---
*Phase: 14-trade-v2*
*Completed: 2026-03-29*
