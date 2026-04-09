---
phase: 26-trade-proposals-counterproposals
plan: 03
subsystem: ui
tags: [react, server-components, trade-proposals, counterproposals, thread-ui, action-bar]

# Dependency graph
requires:
  - phase: 26-trade-proposals-counterproposals
    provides: getProposalHistory query, acceptProposalAction, declineProposalAction, ProposalWithItems type (plan 01)
  - phase: 09-p2p-audio-trading
    provides: TradeDetailPage with TradeActionButtons, TradeDetailHeader, TradeMessageThread
provides:
  - ProposalHistoryThread component rendering ordered proposal cards with offer/want items
  - ProposalActionBar with Accept/Decline/Counter buttons for pending proposals
  - Updated /trades/[id]/page.tsx integrating proposal history and action bar
affects: [26-04, trade-ui, desktop-trade]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "IIFE pattern in JSX for findLast + conditional rendering of ProposalActionBar"
    - "Parallel Promise.all with profile fetch for current user display data"
    - "Inline formatRelativeTime per component (project convention, not shared utility)"

key-files:
  created:
    - apps/web/src/app/(protected)/trades/[id]/_components/ProposalHistoryThread.tsx
    - apps/web/src/app/(protected)/trades/[id]/_components/ProposalActionBar.tsx
  modified:
    - apps/web/src/app/(protected)/trades/[id]/page.tsx

key-decisions:
  - "profiles.id (not profiles.userId) used for current user profile lookup — profiles table PK is auth.users.id"
  - "Legacy TradeActionButtons preserved alongside new ProposalActionBar for backward compat with pre-proposal trades"
  - "IIFE in JSX for pendingProposal findLast to avoid separate variable in server component scope"
  - "Counter button links to /trades/new/[counterpartyId]?tradeId=[id] as entry point for counterproposal flow"

patterns-established:
  - "Proposal thread pattern: server component fetches history, passes to pure display component"
  - "Additive UI pattern: new proposal components coexist with legacy trade buttons"

requirements-completed: [TRD-06]

# Metrics
duration: 3min
completed: 2026-04-09
---

# Phase 26 Plan 03: Proposal History Thread + Action Bar Summary

**Trade detail page now renders full counterproposal negotiation history as visual thread with Accept/Decline/Counter action bar for the active pending proposal**

## Performance

- **Duration:** 3 min
- **Started:** 2026-04-09T17:30:22Z
- **Completed:** 2026-04-09T17:33:34Z
- **Tasks:** 2
- **Files modified:** 3

## Accomplishments
- ProposalHistoryThread displays ordered proposal cards with proposer avatar, round number, status badges, offer/want item pills with quality grades
- ProposalActionBar renders Accept/Decline/Counter buttons only for the non-proposer on the active pending proposal
- Counter button navigates to /trades/new/[counterpartyId]?tradeId=[id] to open the side-by-side counterproposal UI
- Trade detail page fetches proposal history and current user profile in parallel, renders new components between legacy action buttons and presence indicator
- Old trades without proposals render exactly as before (graceful degradation)

## Task Commits

Each task was committed atomically:

1. **Task 1: ProposalHistoryThread component** - `c186c1c` (feat)
2. **Task 2: ProposalActionBar + page integration** - `e0b2909` (feat)

**Plan metadata:** pending

## Files Created/Modified
- `apps/web/src/app/(protected)/trades/[id]/_components/ProposalHistoryThread.tsx` - Pure display component rendering proposal cards as conversation thread with status badges, item pills, and message blocks
- `apps/web/src/app/(protected)/trades/[id]/_components/ProposalActionBar.tsx` - Client component with Accept/Decline/Counter buttons, loading states, error handling
- `apps/web/src/app/(protected)/trades/[id]/page.tsx` - Updated to fetch proposal history + user profile, render ProposalHistoryThread and ProposalActionBar

## Decisions Made
- Used `profiles.id` (not `profiles.userId`) for current user profile lookup, matching the schema where profiles PK is auth.users.id
- Legacy TradeActionButtons preserved alongside new ProposalActionBar for backward compatibility with trades that have no proposal rows
- Used IIFE pattern in JSX for `findLast` on proposalHistory to conditionally render ProposalActionBar without a separate variable
- Counter button links to `/trades/new/[counterpartyId]?tradeId=[id]` as the entry point to the side-by-side counterproposal UI (plan 02)

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None.

## User Setup Required
None - no external service configuration required.

## Known Stubs
None - all data paths are fully wired to server actions and query layer from plan 01.

## Next Phase Readiness
- Proposal history thread and action bar complete, ready for visual verification
- Counter button wired to /trades/new/[counterpartyId]?tradeId=[id] (plan 02 side-by-side UI)
- Plan 04 verification plan can now test full proposal lifecycle in the UI

## Self-Check: PASSED
