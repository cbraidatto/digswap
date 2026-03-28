---
phase: quick
plan: 260328-9gp
subsystem: trades
tags: [trade-expiry, p2p, ux-simplification]

# Dependency graph
requires:
  - phase: 09-p2p-audio-trading
    provides: trade request creation, trade detail page, constants
provides:
  - Fixed 24h trade expiry replacing user-selectable expiry picker
  - Server-rendered expiry countdown on both pending trade views
affects: [trades, p2p]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Server-rendered countdown: compute time remaining at render, refresh on page load"

key-files:
  created: []
  modified:
    - src/lib/trades/constants.ts
    - src/actions/trades.ts
    - src/app/(protected)/trades/new/_components/trade-form.tsx
    - src/app/(protected)/trades/[id]/page.tsx
    - tests/unit/trades/create-trade.test.ts

key-decisions:
  - "Fixed 24h expiry removes decision friction from trade creation UX"
  - "Server-rendered countdown (no client-side interval) -- updates on page refresh, keeps server component purity"

patterns-established:
  - "formatTimeRemaining: reusable server-side relative time formatter for ISO date strings"

requirements-completed: []

# Metrics
duration: 3min
completed: 2026-03-28
---

# Quick 260328-9gp: Lock Trade Lobby Expiry to 24h Fixed Window Summary

**Replaced user-selectable expiry picker with fixed 24h window and added server-rendered countdown to both pending trade views**

## Performance

- **Duration:** 3 min
- **Started:** 2026-03-28T09:51:19Z
- **Completed:** 2026-03-28T09:54:12Z
- **Tasks:** 2
- **Files modified:** 5

## Accomplishments
- Removed TRADE_EXPIRY_OPTIONS and DEFAULT_EXPIRY_HOURS, replaced with single TRADE_EXPIRY_HOURS = 24 constant
- Eliminated expiryHours from createTrade server action parameter type -- all trades now use fixed 24h window
- Replaced Proposal_Expiry button grid with static Review_Window info card showing "24h FIXED WINDOW"
- Added "Expires in Xh Ym" server-rendered countdown to both INCOMING_TRADE_REQUEST and WAITING_FOR_ACCEPTANCE views

## Task Commits

Each task was committed atomically:

1. **Task 1: Hardcode 24h expiry in constants and server action** - `a0862a1` (fix)
2. **Task 2: Replace expiry selector with static info and add countdown to pending views** - `dca9332` (feat)

## Files Created/Modified
- `src/lib/trades/constants.ts` - Removed TRADE_EXPIRY_OPTIONS array, renamed DEFAULT_EXPIRY_HOURS to TRADE_EXPIRY_HOURS = 24
- `src/actions/trades.ts` - Removed expiryHours from formData type, imported TRADE_EXPIRY_HOURS for expiry computation
- `src/app/(protected)/trades/new/_components/trade-form.tsx` - Replaced expiry button picker with static 24h info card, removed expiryHours state
- `src/app/(protected)/trades/[id]/page.tsx` - Added formatTimeRemaining helper and countdown text to both pending views
- `tests/unit/trades/create-trade.test.ts` - Removed expiryHours from test data, added TRADE_EXPIRY_HOURS to mock

## Decisions Made
- Fixed 24h window simplifies trade UX by removing decision friction from trade creation
- Server-rendered countdown preserves server component purity (no client-side JS interval)

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None.

## Known Stubs
None.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Trade expiry is now uniform across all trades at 24 hours
- No blockers

## Self-Check: PASSED

All 5 modified files verified present. Both task commits (a0862a1, dca9332) verified in git log.

---
*Quick: 260328-9gp*
*Completed: 2026-03-28*
