---
phase: 06-discovery-notifications
plan: 03
subsystem: ui
tags: [notifications, realtime, supabase, popover, bell, websocket]

# Dependency graph
requires:
  - phase: 06-01
    provides: notification server actions, queries, and DB schema
provides:
  - NotificationBell component with Realtime subscription
  - NotificationRow reusable component
  - /notifications page with pagination
  - userId threading from ProtectedLayout to AppHeader
affects: [06-04, 06-05]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Realtime postgres_changes subscription with user_id filter for scoped notifications"
    - "userId prop threading from server layout through client shell components"

key-files:
  created:
    - src/components/shell/notification-bell.tsx
    - src/components/shell/notification-row.tsx
    - src/app/(protected)/notifications/page.tsx
    - src/app/(protected)/notifications/layout.tsx
  modified:
    - src/components/shell/app-header.tsx
    - src/components/shell/app-shell.tsx
    - src/app/(protected)/layout.tsx
    - src/actions/notifications.ts
    - tests/unit/components/shell/app-header.test.tsx

key-decisions:
  - "Added getRecentNotificationsAction to server actions for dropdown data fetching (missing from Plan 01 outputs)"
  - "NotificationBell uses base-ui Popover with open/onOpenChange controlled state for programmatic close"
  - "Mock NotificationBell in AppHeader tests to avoid Base UI Popover + Realtime complexity in jsdom"

patterns-established:
  - "Realtime notification subscription: channel named notifications-{userId} with postgres_changes INSERT filter"
  - "Notification type icon mapping via switch statement in NotificationRow"

requirements-completed: [NOTF-01, NOTF-02]

# Metrics
duration: 5min
completed: 2026-03-26
---

# Phase 6 Plan 3: Notification Bell + Page Summary

**NotificationBell with Supabase Realtime subscription, unread badge, Popover dropdown, and paginated /notifications page wired into AppHeader**

## Performance

- **Duration:** 5 min
- **Started:** 2026-03-26T05:01:10Z
- **Completed:** 2026-03-26T05:06:10Z
- **Tasks:** 2
- **Files modified:** 9

## Accomplishments
- NotificationBell component with Realtime postgres_changes subscription filtered by userId for live notification delivery
- Unread badge with 9+ overflow, Popover dropdown showing 5 most recent notifications with mark-all-read and per-notification navigation
- NotificationRow reusable component with type-based Material Symbol icons and relative timestamps
- Full /notifications page with paginated list, empty state, and Previous/Next navigation
- userId successfully threaded from ProtectedLayout through AppShell to AppHeader to NotificationBell

## Task Commits

Each task was committed atomically:

1. **Task 1: Build NotificationBell and NotificationRow components** - `8b29499` (feat)
2. **Task 2: Wire NotificationBell into AppHeader, thread userId, create /notifications page** - `0f0b021` (feat)

## Files Created/Modified
- `src/components/shell/notification-bell.tsx` - Bell icon with Realtime subscription, Popover dropdown, unread badge, mark-all-read
- `src/components/shell/notification-row.tsx` - Reusable notification row with type icons and relative timestamps
- `src/app/(protected)/notifications/page.tsx` - Full notifications page with pagination (20 per page)
- `src/app/(protected)/notifications/layout.tsx` - Pass-through layout for notifications route
- `src/components/shell/app-header.tsx` - Replaced static bell button with NotificationBell component, added userId prop
- `src/components/shell/app-shell.tsx` - Added id to user interface, passes userId to AppHeader
- `src/app/(protected)/layout.tsx` - Added user.id to AppShell user object
- `src/actions/notifications.ts` - Added getRecentNotificationsAction for dropdown data fetching
- `tests/unit/components/shell/app-header.test.tsx` - Updated with userId prop and NotificationBell mock

## Decisions Made
- Added `getRecentNotificationsAction` server action since it was referenced in interfaces but missing from Plan 01 outputs (Rule 3 -- blocking)
- Used base-ui Popover `open/onOpenChange` controlled state pattern (consistent with existing ConditionEditor usage)
- Mocked NotificationBell in AppHeader tests to avoid Base UI Popover + Realtime complexity in jsdom (consistent with existing UserAvatarMenu mock pattern)

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Added missing getRecentNotificationsAction to server actions**
- **Found during:** Task 1 (NotificationBell implementation)
- **Issue:** Plan referenced getRecentNotificationsAction in interfaces but it was not present in src/actions/notifications.ts
- **Fix:** Added getRecentNotificationsAction that wraps getRecentNotifications query with auth check
- **Files modified:** src/actions/notifications.ts
- **Verification:** TypeScript compilation passes, import resolves correctly
- **Committed in:** 8b29499 (Task 1 commit)

**2. [Rule 1 - Bug] Updated AppHeader tests with new userId prop and NotificationBell mock**
- **Found during:** Task 2 (AppHeader modification)
- **Issue:** Adding userId as required prop to AppHeader broke existing tests (missing prop error)
- **Fix:** Added userId to test renders and mocked NotificationBell component
- **Files modified:** tests/unit/components/shell/app-header.test.tsx
- **Verification:** All 2 AppHeader tests pass
- **Committed in:** 0f0b021 (Task 2 commit)

---

**Total deviations:** 2 auto-fixed (1 blocking, 1 bug)
**Impact on plan:** Both auto-fixes necessary for correctness. No scope creep.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Notification bell fully wired into the app shell -- ready for explore page and notification preferences (Plans 04, 05)
- Realtime subscription pattern established for other real-time features
- NotificationRow is reusable across both dropdown and full page contexts

## Self-Check: PASSED

- All 4 created files exist on disk
- Commit 8b29499 (Task 1) verified in git log
- Commit 0f0b021 (Task 2) verified in git log

---
*Phase: 06-discovery-notifications*
*Completed: 2026-03-26*
