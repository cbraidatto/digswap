---
phase: 26-trade-proposals-counterproposals
plan: 04
subsystem: ui
tags: [react, next.js, trade-proposals, counterproposals, inbox, server-components, drizzle]

# Dependency graph
requires:
  - phase: 26-trade-proposals-counterproposals
    provides: createCounterproposalAction (plan 01), ProposalBuilder (plan 02), ProposalActionBar Counter button (plan 03)
provides:
  - Counter mode in ProposalBuilder wired to createCounterproposalAction via ?tradeId searchParam
  - hasPendingProposal + pendingProposalForMe flags in listTradeThreads query
  - "Counter needed" badge on trade inbox cards with proposal summary text
affects: [trade-ui, desktop-trade]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "searchParams Promise await for counter mode detection in server page"
    - "Batch SQL DISTINCT ON for pending proposal flag aggregation"
    - "Conditional action dispatch: isCounterMode toggles createProposalAction vs createCounterproposalAction"

key-files:
  created: []
  modified:
    - apps/web/src/app/(protected)/trades/new/[userId]/page.tsx
    - apps/web/src/app/(protected)/trades/new/[userId]/_components/ProposalBuilder.tsx
    - apps/web/src/app/(protected)/trades/page.tsx
    - apps/web/src/lib/trades/messages.ts

key-decisions:
  - "Batch DISTINCT ON query for pending proposals rather than per-thread N+1 EXISTS subqueries"
  - "Counter mode back link goes to /trades/[tradeId] (not /trades) for natural navigation flow"
  - "pendingProposalForMe flag derived from proposer_id != viewer check in JS (not SQL)"

patterns-established:
  - "Counter mode detection: ?tradeId in searchParams -> isCounterMode boolean in client component"
  - "Pending proposal map: batch query returns proposer_id per trade, JS derives forMe flag"

requirements-completed: [TRD-03, TRD-06]

# Metrics
duration: 3min
completed: 2026-04-09
---

# Phase 26 Plan 04: Counterproposal Wiring + Inbox Badge Summary

**End-to-end counterproposal flow: ?tradeId param triggers counter mode in ProposalBuilder routing to createCounterproposalAction, with batch-queried "Counter needed" badges on trade inbox threads**

## Performance

- **Duration:** 3 min
- **Started:** 2026-04-09T17:38:01Z
- **Completed:** 2026-04-09T17:40:52Z
- **Tasks:** 2 (of 3 -- Task 3 is human-verify checkpoint)
- **Files modified:** 4

## Accomplishments
- Server page reads ?tradeId from searchParams and passes to ProposalBuilder as prop for counter mode detection
- ProposalBuilder conditionally uses createCounterproposalAction when tradeId is present, with counter-specific header, back link, placeholder text, and "Send Counteroffer" button label
- listTradeThreads now returns hasPendingProposal and pendingProposalForMe via batch DISTINCT ON SQL query against trade_proposals
- Trade inbox TradeCard shows "Counter needed" badge and contextual summary text for threads with pending proposals directed at the viewer

## Task Commits

Each task was committed atomically:

1. **Task 1: Counter mode in page + ProposalBuilder + messages list update** - `fc10ce7` (feat)
2. **Task 2: Trade inbox counter badge** - `632befb` (feat)

**Plan metadata:** pending

## Files Created/Modified
- `apps/web/src/app/(protected)/trades/new/[userId]/page.tsx` - Reads ?tradeId from searchParams, passes to ProposalBuilder for counter mode
- `apps/web/src/app/(protected)/trades/new/[userId]/_components/ProposalBuilder.tsx` - Dual-mode: normal proposal vs counterproposal with action dispatch, labels, and navigation
- `apps/web/src/lib/trades/messages.ts` - Added hasPendingProposal + pendingProposalForMe flags via batch pending proposal query
- `apps/web/src/app/(protected)/trades/page.tsx` - TradeCard shows "Counter needed" badge and contextual summary text

## Decisions Made
- Used batch DISTINCT ON query for pending proposals instead of per-thread EXISTS subqueries for performance consistency with existing unread count batch pattern
- Counter mode back link navigates to `/trades/[tradeId]` rather than `/trades` for better UX flow
- pendingProposalForMe flag is derived in JS (proposer_id !== userId) rather than SQL -- cleaner separation since the pending proposal map already has the proposer_id

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None.

## User Setup Required
None - no external service configuration required.

## Known Stubs
None - all data paths are fully wired to server actions and query layer.

## Next Phase Readiness
- Full counterproposal loop is wired end-to-end
- Ready for human verification checkpoint (Task 3): create proposal, counter, verify badge, accept
- All Phase 26 plan artifacts complete pending checkpoint verification

## Self-Check: PASSED
