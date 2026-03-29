---
phase: quick-260328-tef
plan: 01
subsystem: ui
tags: [react, notifications, trades, websocket, server-actions]

requires:
  - phase: 06-discovery-notifications
    provides: NotificationBell component, notification actions
  - phase: 09-p2p-trading
    provides: trades.ts server actions, trade_requests table
provides:
  - "Fixed notification badge: awaits server confirmation before decrementing, re-syncs on popover open"
  - "Trade icon with actionable count badge in AppHeader navbar"
  - "getActionableTradeCount server action for pending/active trade counts"
affects: [shell, trades, notifications]

tech-stack:
  added: []
  patterns:
    - "Await server action result before optimistic UI update (notification bell)"
    - "Re-sync client state with server on popover open to handle drift"

key-files:
  created: []
  modified:
    - src/components/shell/notification-bell.tsx
    - src/components/shell/app-header.tsx
    - src/actions/trades.ts
    - tests/unit/components/shell/notification-bell.test.tsx
    - tests/unit/components/shell/app-header.test.tsx

key-decisions:
  - "AppHeader converted to client component for TradeBadge useEffect/useState"
  - "getActionableTradeCount returns 0 silently for unauthenticated users instead of throwing"

patterns-established:
  - "Server-confirmed optimistic updates: await action result, only update UI on success"

requirements-completed: []

duration: 4min
completed: 2026-03-28
---

# Quick Task 260328-tef: Fix Notification Badge Stale Count + Add Trade Icon Summary

**Fixed fire-and-forget markNotificationRead causing stale badge counts, added server re-sync on popover open, and added trade icon with actionable-count badge to AppHeader**

## Performance

- **Duration:** 4 min
- **Started:** 2026-03-29T00:15:32Z
- **Completed:** 2026-03-29T00:19:24Z
- **Tasks:** 2
- **Files modified:** 5

## Accomplishments
- Notification badge now only decrements after server confirms mark-as-read succeeded
- Popover open re-fetches unread count and recent notifications from server (handles drift from other tabs, failed silent marks)
- Trade icon (swap_horiz) with actionable badge appears in AppHeader beside notification bell
- getActionableTradeCount counts pending trades where user is provider + accepted/transferring trades where user is participant

## Task Commits

Each task was committed atomically:

1. **Task 1: Fix stale notification badge count** - `eca7d4f` (fix)
2. **Task 2: Add trade icon with actionable badge to AppHeader** - `317a372` (feat)

## Files Created/Modified
- `src/components/shell/notification-bell.tsx` - Fixed handleNotificationClick to await markNotificationRead, added handleOpenChange for server re-sync
- `src/components/shell/app-header.tsx` - Converted to client component, added TradeBadge with swap_horiz icon and count badge
- `src/actions/trades.ts` - Added getActionableTradeCount server action
- `tests/unit/components/shell/notification-bell.test.tsx` - Added test for failed mark-read not decrementing count
- `tests/unit/components/shell/app-header.test.tsx` - Added trade icon tests, fixed pre-existing DIGSWAP wordmark assertion

## Decisions Made
- AppHeader converted to client component (`"use client"`) because TradeBadge needs useEffect/useState for fetching count. This is consistent since NotificationBell (already client) and AppShell (parent, already client) are both client components.
- getActionableTradeCount silently returns 0 for unauthenticated users instead of throwing, so the header never crashes.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed pre-existing DIGSWAP wordmark test assertions**
- **Found during:** Task 2 (AppHeader tests)
- **Issue:** Existing tests used `screen.getByText("DIGSWAP")` but the text is split across two child spans (`<span>DIG</span><span>SWAP</span>`), causing assertion failure
- **Fix:** Changed to `getByText("DIG")` + `getByText("SWAP")` and `dig.parentElement.className` for font-heading check
- **Files modified:** tests/unit/components/shell/app-header.test.tsx
- **Verification:** All 5 AppHeader tests pass
- **Committed in:** 317a372 (Task 2 commit)

---

**Total deviations:** 1 auto-fixed (1 bug)
**Impact on plan:** Pre-existing test assertion bug, minimal scope impact. Fix was 4 lines.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Known Stubs
None - all components wired to real data sources (server actions + Supabase queries).

## Self-Check: PASSED

- All 5 modified files exist on disk
- Commit eca7d4f (Task 1) found in git log
- Commit 317a372 (Task 2) found in git log
- SUMMARY.md created at expected path

---
*Quick task: 260328-tef*
*Completed: 2026-03-28*
