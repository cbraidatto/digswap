---
phase: 14-trade-v2
plan: "03"
subsystem: ui, api
tags: [supabase-realtime, presence, state-machine, webrtc, negotiation, server-actions]

# Dependency graph
requires:
  - phase: 14-trade-v2 plan 01
    provides: "Schema migration with new status enum values + bilateral acceptance timestamp columns"
provides:
  - "Lobby state machine with waiting_both -> negotiation -> preview_selection flow"
  - "Supabase Realtime Presence for online detection in trade lobby"
  - "acceptTerms, declineTerms, updateLastJoinedLobby server actions"
  - "Bilateral negotiation UI with side-by-side terms display"
affects: [14-04-preview-transfer, 14-05-verification]

# Tech tracking
tech-stack:
  added: []
  patterns: ["Supabase Realtime Presence channels for lobby online detection", "Multi-phase lobby state machine with DB-status initialization"]

key-files:
  created: []
  modified:
    - "src/actions/trades.ts"
    - "src/app/(protected)/trades/[id]/_components/trade-lobby.tsx"
    - "src/app/(protected)/trades/[id]/page.tsx"

key-decisions:
  - "Supabase Presence on channel trade:${tradeId} for real-time presence (not postgres_changes)"
  - "Kept postgres_changes as backup for DB status change notifications from counterparty server actions"
  - "State machine initializes from DB status on mount for page reload resilience"

patterns-established:
  - "Supabase Realtime Presence: channel.track() + presenceState() for lobby online detection"
  - "Bilateral timestamp acceptance: role-based field selection (requester vs recipient) in server actions"

requirements-completed: [TRADE2-04, TRADE2-05, TRADE2-09, TRADE2-10]

# Metrics
duration: 4min
completed: 2026-03-29
---

# Phase 14 Plan 03: Lobby State Machine + Supabase Presence + Negotiation Summary

**Multi-phase lobby state machine with Supabase Realtime Presence for online detection and bilateral negotiation UI for trade terms acceptance**

## Performance

- **Duration:** 4 min
- **Started:** 2026-03-29T14:26:09Z
- **Completed:** 2026-03-29T14:30:53Z
- **Tasks:** 3
- **Files modified:** 3

## Accomplishments
- Replaced database-polling presence detection with Supabase Realtime Presence channels
- Implemented multi-phase state machine: waiting_both -> negotiation -> preview_selection -> (handoff to 14-04)
- Added acceptTerms/declineTerms server actions with bilateral timestamp tracking and LOBBY status gate
- Built negotiation UI with side-by-side proposer offer and requested release cards
- Updated trade page to pass all new fields and handle lobby/previewing/accepted/transferring statuses

## Task Commits

Each task was committed atomically:

1. **Task 1: Add new server actions for negotiation** - `b0af37f` (feat)
2. **Task 2: Redesign TradeLobby with Presence + state machine** - `987ad42` (feat)
3. **Task 3: Update trade page to pass new props** - `8ef06e4` (feat)

## Files Created/Modified
- `src/actions/trades.ts` - Added acceptTerms, declineTerms, updateLastJoinedLobby; updated validTransitions to include LOBBY -> PREVIEWING
- `src/app/(protected)/trades/[id]/_components/trade-lobby.tsx` - Complete redesign with 9-state lobby state machine, Supabase Presence, and negotiation UI (646 lines)
- `src/app/(protected)/trades/[id]/page.tsx` - Updated to pass new props and render TradeLobby for lobby/previewing/accepted/transferring statuses

## Decisions Made
- Used Supabase Realtime Presence on `trade:${tradeId}` channel with userId as presence key, per D-06
- Kept postgres_changes subscription alongside Presence for detecting DB status changes from counterparty server actions (status transitions, bilateral acceptance timestamps)
- State machine initializes from trade's DB status on mount for resilience to page reloads -- if terms already accepted, skips to preview_selection
- Updated validTransitions map to include LOBBY -> PREVIEWING path for updateTradeStatus server action

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None

## Known Stubs
- **preview_selection state in trade-lobby.tsx (line ~444)**: Placeholder file selection UI without SHA-256 hashing or preview generation -- Plan 14-04 will wire this fully

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Plan 14-04 can build on preview_selection state to add file selection, SHA-256 hashing, and preview generation
- All server actions for negotiation are in place and tested at the type level
- Supabase Realtime Presence is wired and will trigger negotiation flow when both users join

## Self-Check: PASSED

- All 3 source files verified present on disk
- All 3 task commits verified in git history (b0af37f, 987ad42, 8ef06e4)

---
*Phase: 14-trade-v2*
*Completed: 2026-03-29*
