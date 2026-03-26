---
phase: 06-discovery-notifications
plan: 01
subsystem: api
tags: [drizzle, supabase, resend, discovery, notifications, server-actions, vitest]

# Dependency graph
requires:
  - phase: 01-foundation
    provides: DB schema (releases, collections, wantlist, notifications, follows, profiles)
  - phase: 03-discogs-import
    provides: Release data in releases table with rarity scores
  - phase: 05-social-layer
    provides: Follow relationships in follows table
provides:
  - searchRecords query for title/artist ILIKE search with owner grouping
  - browseRecords query for genre/decade filtering with PostgreSQL array contains
  - getSuggestedRecords taste-based recommendations from top genres + followed users
  - checkWantlistMatches cross-user notification pipeline with email
  - sendWantlistMatchEmail Resend email wrapper with non-fatal error handling
  - Notification queries (unread count, pagination, preferences CRUD)
  - Discovery server actions (searchRecordsAction, browseRecordsAction, getSuggestionsAction)
  - Notification server actions (getNotificationsAction, markNotificationRead, markAllRead, getPreferencesAction, updatePreferencesAction)
affects: [06-02-discovery-ui, 06-03-notification-ui, 06-04-real-time-notifications]

# Tech tracking
tech-stack:
  added: []
  patterns: [thenable-mock-chain for Drizzle unit testing, admin-client for cross-user writes, non-fatal-email pattern]

key-files:
  created:
    - src/lib/discovery/queries.ts
    - src/actions/discovery.ts
    - src/lib/notifications/match.ts
    - src/lib/notifications/email.ts
    - src/lib/notifications/queries.ts
    - src/actions/notifications.ts
    - tests/unit/discovery/record-search.test.ts
    - tests/unit/discovery/genre-browse.test.ts
    - tests/unit/discovery/taste-match.test.ts
    - tests/unit/notifications/wantlist-match.test.ts
    - tests/unit/notifications/email.test.ts
    - tests/unit/notifications/preferences.test.ts
  modified: []

key-decisions:
  - "Drizzle thenable chain mock pattern for unit testing query builders without real DB"
  - "Admin client for checkWantlistMatches cross-user notification inserts (bypasses RLS)"
  - "Non-fatal email pattern: sendWantlistMatchEmail catches all errors, never throws"
  - "Notification preferences lazy-created on first getPreferencesAction call (D-18)"
  - "Release discogs_id null check skips wantlist matching for non-canonical releases (D-16)"

patterns-established:
  - "Thenable mock chain: vi.mock @/lib/db with .then() on chain for sequential query results"
  - "Non-fatal wrappers: email/notification functions catch and console.error, never throw"
  - "Discovery queries return typed interfaces (SearchResult, BrowseResult, SuggestionResult)"

requirements-completed: [DISC2-01, DISC2-02, DISC2-03, DISC2-04, NOTF-01, NOTF-02, NOTF-04]

# Metrics
duration: 8min
completed: 2026-03-26
---

# Phase 6 Plan 01: Discovery & Notification Data Layer Summary

**Discovery queries (search, browse, taste-match) and notification infrastructure (wantlist match checker, Resend email, notification CRUD) with 28 passing unit tests**

## Performance

- **Duration:** 8 min
- **Started:** 2026-03-26T04:48:59Z
- **Completed:** 2026-03-26T04:57:13Z
- **Tasks:** 2
- **Files modified:** 12

## Accomplishments
- 3 discovery query functions with Drizzle: ILIKE search with owner grouping, genre/decade browse with PostgreSQL array contains, taste-based suggestions from top genres and followed users
- Wantlist match checker using admin client for cross-user notification inserts with email preferences check
- Resend email helper with dark-themed HTML template and non-fatal error handling
- 5 notification server actions with auth + ownership checks + lazy preference creation
- 28 unit tests all passing across 6 test files

## Task Commits

Each task was committed atomically:

1. **Task 1: Create discovery query functions and server actions** - `1ced0f4` (feat)
2. **Task 2: Create notification infrastructure** - `ee15266` (feat)

## Files Created/Modified
- `src/lib/discovery/queries.ts` - searchRecords, browseRecords, getSuggestedRecords query functions
- `src/actions/discovery.ts` - Server actions wrapping discovery queries with auth
- `src/lib/notifications/match.ts` - checkWantlistMatches with admin client cross-user writes
- `src/lib/notifications/email.ts` - sendWantlistMatchEmail via Resend with non-fatal error handling
- `src/lib/notifications/queries.ts` - getUnreadCount, getRecentNotifications, getNotificationPage, getPreferences, upsertPreferences
- `src/actions/notifications.ts` - 5 server actions with auth, ownership checks, lazy prefs creation
- `tests/unit/discovery/record-search.test.ts` - 5 tests: search with owners, empty results, special chars
- `tests/unit/discovery/genre-browse.test.ts` - 5 tests: genre/decade filters, pagination
- `tests/unit/discovery/taste-match.test.ts` - 4 tests: genre recs, follow recs, empty, dedup
- `tests/unit/notifications/wantlist-match.test.ts` - 5 tests: match flow, skip scenarios, error handling
- `tests/unit/notifications/email.test.ts` - 3 tests: subject, error tolerance, body content
- `tests/unit/notifications/preferences.test.ts` - 6 tests: get/upsert preferences, unread count

## Decisions Made
- Drizzle thenable chain mock pattern: each test sets queryResults array, .then() resolves sequentially -- avoids complex mock orchestration for multi-query functions
- Admin client (not Drizzle) for checkWantlistMatches because it writes notifications across users, requiring RLS bypass
- Email failure is non-fatal at two levels: sendWantlistMatchEmail catches errors, and checkWantlistMatches catches per-user notification failures
- Notification preferences lazy-created on first getPreferencesAction call to avoid requiring a migration or seed step
- Releases without discogs_id are skipped by wantlist matching to avoid false matches on non-canonical records

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
- Drizzle query builder mocking initially failed because vi.mock hoists factory functions above variable declarations. Fixed by using thenable chain pattern with vi.hoisted() for email test and module-scoped counter variables for sequential query resolution.

## User Setup Required

None - no external service configuration required. Resend API key is already configured from prior phases.

## Known Stubs

None - all functions are fully wired to their data sources with no placeholder values.

## Next Phase Readiness
- Discovery queries ready for UI components in Plan 02 (search page, browse page)
- Notification queries ready for UI components in Plan 03 (notification dropdown, preferences page)
- checkWantlistMatches ready to be called from addRecordToCollection in Plan 04 (real-time integration)

## Self-Check: PASSED

- All 12 created files verified on disk
- Commit 1ced0f4 (Task 1) found in git log
- Commit ee15266 (Task 2) found in git log
- 28/28 tests passing across 6 test files

---
*Phase: 06-discovery-notifications*
*Completed: 2026-03-26*
