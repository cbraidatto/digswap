---
phase: 09-p2p-audio-trading
plan: 03
subsystem: webrtc, ui
tags: [peerjs, webrtc, p2p, trade-form, file-upload, drag-and-drop]

# Dependency graph
requires:
  - phase: 09-01
    provides: chunked-transfer module, trade actions, trade constants
provides:
  - PeerJS npm dependency installed
  - usePeerConnection React hook for WebRTC lifecycle
  - IceServerConfig types and DEFAULT_STUN
  - /trades/new wired with real TradeForm (file upload, metadata, expiry, send)
  - REQUEST_AUDIO button on public profile collection cards
  - REQUEST_TRADE link on explorar owner rows
  - REQUEST_TRADE CTA on wantlist_match notification rows
affects: [09-04, 09-05, 09-06]

# Tech tracking
tech-stack:
  added: [peerjs]
  patterns: [renderAction slot pattern for CollectionGrid extensibility, WebRTC hook with flow control]

key-files:
  created:
    - src/lib/webrtc/turn-config.ts
    - src/lib/webrtc/use-peer-connection.ts
    - src/app/(protected)/trades/new/_components/trade-form.tsx
    - src/app/(protected)/(profile)/perfil/_components/request-audio-button.tsx
  modified:
    - src/app/(protected)/trades/new/page.tsx
    - src/app/(protected)/(profile)/perfil/[username]/page.tsx
    - src/app/(protected)/(profile)/perfil/_components/collection-card.tsx
    - src/app/(protected)/(profile)/perfil/_components/collection-grid.tsx
    - src/app/(protected)/(explore)/explorar/_components/owners-list.tsx
    - src/components/shell/notification-row.tsx

key-decisions:
  - "renderAction slot pattern on CollectionGrid/CollectionCard for extensible per-card actions (P2P button without tight coupling)"
  - "NotificationRow metadata field added for wantlist_match trade URL construction (matchUserId + releaseId)"
  - "OwnersListProps extended with p2pEnabled and currentUserId for REQUEST_TRADE gating without breaking existing usage"

patterns-established:
  - "renderAction callback on CollectionGrid: enables passing arbitrary action ReactNodes per collection item"
  - "WebRTC hook pattern: usePeerConnection encapsulates PeerJS lifecycle with flow control via bufferedAmount"

requirements-completed: [P2P-01, P2P-02, P2P-03, SEC-07]

# Metrics
duration: 7min
completed: 2026-03-27
---

# Phase 09 Plan 03: WebRTC Hook + Trade Form + Entry Points Summary

**PeerJS installed with usePeerConnection hook (flow control, chunked transfer), /trades/new rewritten with real TradeForm (drag-and-drop upload, metadata, expiry), and 3 trade initiation entry points wired (profile, explorar, notifications)**

## Performance

- **Duration:** 7 min
- **Started:** 2026-03-27T20:18:42Z
- **Completed:** 2026-03-27T20:25:56Z
- **Tasks:** 2
- **Files modified:** 12

## Accomplishments
- PeerJS installed and usePeerConnection hook created with full WebRTC lifecycle (init, connect, send/receive with chunked transfer, retry, cleanup) and bufferedAmount flow control
- /trades/new page converted from static stub to server component with searchParams, counterparty/release lookup, and client TradeForm with drag-and-drop file upload, format/bitrate metadata, expiry selector, and createTrade server action integration
- Three trade initiation entry points wired: REQUEST_AUDIO on public profile collection cards, REQUEST_TRADE on explorar owner rows, REQUEST_TRADE CTA on wantlist_match notifications

## Task Commits

Each task was committed atomically:

1. **Task 1: Install PeerJS + WebRTC hook + TURN config + Trade form wiring** - `fcb7fd5` (feat)
2. **Task 2: Trade initiation entry points (profile, explorar, notifications)** - `c1978a4` (feat)

## Files Created/Modified
- `src/lib/webrtc/turn-config.ts` - IceServerConfig type and DEFAULT_STUN constant
- `src/lib/webrtc/use-peer-connection.ts` - React hook for PeerJS lifecycle with flow control
- `src/app/(protected)/trades/new/page.tsx` - Server component with searchParams for counterparty/release
- `src/app/(protected)/trades/new/_components/trade-form.tsx` - Client component with drag-and-drop file upload, metadata fields, expiry selector, send button
- `src/app/(protected)/(profile)/perfil/_components/request-audio-button.tsx` - REQUEST_AUDIO link for collection cards
- `src/app/(protected)/(profile)/perfil/[username]/page.tsx` - Imports RequestAudioButton and isP2PEnabled, passes renderAction to CollectionGrid
- `src/app/(protected)/(profile)/perfil/_components/collection-card.tsx` - Added actionSlot prop
- `src/app/(protected)/(profile)/perfil/_components/collection-grid.tsx` - Added renderAction prop
- `src/app/(protected)/(explore)/explorar/_components/owners-list.tsx` - Added REQUEST_TRADE link with p2pEnabled/currentUserId gating
- `src/components/shell/notification-row.tsx` - Added REQUEST_TRADE CTA for wantlist_match with metadata extraction

## Decisions Made
- Extended CollectionCard/CollectionGrid with an actionSlot/renderAction pattern rather than hardcoding the RequestAudioButton -- keeps components generic and reusable
- Added metadata field to NotificationData interface for structured wantlist_match data (matchUserId, releaseId) to construct trade URLs
- OwnersListProps extended with optional p2pEnabled and currentUserId props with defaults for backward compatibility

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- WebRTC hook ready for consumption by the trade lobby page (09-04)
- All three entry points navigate to /trades/new with proper query params
- TradeForm creates trade requests via existing createTrade server action

## Self-Check: PASSED

- All 4 created files exist on disk
- Both commit hashes (fcb7fd5, c1978a4) verified in git log
- TypeScript compilation passes (no errors in new/modified files)
- All acceptance criteria verified

---
*Phase: 09-p2p-audio-trading*
*Completed: 2026-03-27*
