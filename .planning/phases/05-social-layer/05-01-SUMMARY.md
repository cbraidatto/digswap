---
phase: 05-social-layer
plan: 01
subsystem: api
tags: [drizzle, server-actions, social, follow, feed, comparison, postgres]

# Dependency graph
requires:
  - phase: 04-collection-browsing-ui
    provides: "Collection queries, collection items schema, releases schema"
  - phase: 01-foundation
    provides: "Auth, Supabase client, DB schema with social tables"
provides:
  - "followUser/unfollowUser server actions with auth and self-follow guard"
  - "logActivity server action for activity feed inserts"
  - "loadMoreFeed server action with cursor pagination (personal/global modes)"
  - "searchUsers server action with ilike on username"
  - "getGlobalFeed/getPersonalFeed query functions with joined release metadata"
  - "getFollowCounts/getFollowers/getFollowing/checkIsFollowing query functions"
  - "getProgressBarState for onboarding progress bar"
  - "getCollectionComparison with discogsId + artist+title fallback matching"
  - "logActivity wired into addRecordToCollection (non-blocking)"
affects: [05-social-layer, 06-community-groups, 07-gamification]

# Tech tracking
tech-stack:
  added: []
  patterns: ["Server action auth pattern: createClient() + getUser() guard", "Cursor-based feed pagination with ISO timestamp cursors", "Non-blocking activity logging in try/catch (failure does not fail parent action)", "Collection comparison via JS Set on discogsId with artist+title fallback"]

key-files:
  created:
    - "src/actions/social.ts"
    - "src/lib/social/queries.ts"
    - "src/lib/social/comparison.ts"
    - "tests/unit/social/follow.test.ts"
    - "tests/unit/social/unfollow.test.ts"
    - "tests/unit/social/feed.test.ts"
    - "tests/unit/social/compare.test.ts"
    - "tests/unit/social/public-profile.test.ts"
  modified:
    - "src/actions/collection.ts"

key-decisions:
  - "logActivity wired non-blocking into addRecordToCollection -- activity logging failure does not fail the add-record action"
  - "searchUsers sanitizes ilike patterns (%, _, \\) to prevent SQL injection via wildcard characters"
  - "getCollectionComparison safeguard: returns empty result if either collection exceeds 5000 items"
  - "getFollowing joins profiles on followingId (the person being followed) not followerId"

patterns-established:
  - "Social query functions in src/lib/social/queries.ts are pure (no 'use server'), imported by server actions"
  - "FeedItem type exported from src/actions/social.ts, shared by queries module"
  - "Test files mock @/lib/db, drizzle-orm, and schema modules with vi.mock() for full isolation"

requirements-completed: [SOCL-01, SOCL-02, SOCL-03, SOCL-04, SOCL-05]

# Metrics
duration: 5min
completed: 2026-03-26
---

# Phase 5 Plan 1: Social Data Layer Summary

**Server actions (follow/unfollow/logActivity/loadMoreFeed/searchUsers), query functions (feed/follow/comparison), and 24 passing tests for the social data layer**

## Performance

- **Duration:** 5 min
- **Started:** 2026-03-26T02:58:50Z
- **Completed:** 2026-03-26T03:04:35Z
- **Tasks:** 2
- **Files modified:** 9

## Accomplishments
- 5 server actions in src/actions/social.ts: followUser, unfollowUser, logActivity, loadMoreFeed, searchUsers
- 7 query functions in src/lib/social/queries.ts: getGlobalFeed, getPersonalFeed, getFollowCounts, getFollowers, getFollowing, checkIsFollowing, getProgressBarState
- 1 comparison function in src/lib/social/comparison.ts: getCollectionComparison with discogsId + artist+title fallback
- logActivity wired into addRecordToCollection in src/actions/collection.ts
- 24 passing tests across 5 test files covering SOCL-01 through SOCL-05
- Full test suite passes with 194 tests, 0 regressions

## Task Commits

Each task was committed atomically:

1. **Task 1: Create Wave 0 test stubs and type contracts** - `c4e53a3` (test)
2. **Task 2: Build social server actions, query functions, and wire logActivity** - `1d2e1e4` (feat)

## Files Created/Modified
- `src/actions/social.ts` - Server actions: followUser, unfollowUser, logActivity, loadMoreFeed, searchUsers
- `src/lib/social/queries.ts` - Query functions: getGlobalFeed, getPersonalFeed, getFollowCounts, getFollowers, getFollowing, checkIsFollowing, getProgressBarState
- `src/lib/social/comparison.ts` - getCollectionComparison with 3-set output (uniqueToMe, inCommon, uniqueToThem)
- `src/actions/collection.ts` - Added logActivity("added_record") call after successful collection insert
- `tests/unit/social/follow.test.ts` - 7 tests for followUser/unfollowUser actions
- `tests/unit/social/unfollow.test.ts` - 3 tests for unfollowUser edge cases
- `tests/unit/social/feed.test.ts` - 5 tests for getGlobalFeed/getPersonalFeed
- `tests/unit/social/compare.test.ts` - 4 tests for getCollectionComparison
- `tests/unit/social/public-profile.test.ts` - 5 tests for follow counts and profile queries

## Decisions Made
- logActivity is called non-blocking (wrapped in try/catch) inside addRecordToCollection so activity logging failures do not block the user from adding records
- searchUsers sanitizes ilike wildcard characters (%, _, \) before passing to query to prevent injection
- getCollectionComparison returns empty arrays if either collection exceeds 5000 items (performance safeguard per RESEARCH.md Pitfall 5)
- FeedItem type is exported from src/actions/social.ts and imported by queries.ts (shared type contract)

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed getFollowing join condition**
- **Found during:** Task 2 (Build social server actions)
- **Issue:** getFollowing was joining profiles on follows.followerId instead of follows.followingId, which would return the wrong profiles (the follower's profile repeated instead of the profiles being followed)
- **Fix:** Changed innerJoin to use eq(follows.followingId, profiles.id) and where to eq(follows.followerId, userId)
- **Files modified:** src/lib/social/queries.ts
- **Verification:** Tests pass, code logic verified
- **Committed in:** 1d2e1e4 (Task 2 commit)

---

**Total deviations:** 1 auto-fixed (1 bug)
**Impact on plan:** Essential correctness fix. No scope creep.

## Issues Encountered
- Test mock chains needed `where()` to return chain instead of resolving directly, since source code chains `.where().orderBy().limit().offset()` -- fixed by making mock's `where` return the chain object with a `.then()` fallback for queries that end at where.

## Known Stubs
None -- all functions are fully implemented with real Drizzle query logic.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- All social data layer functions are ready for Plans 02-04 (UI components)
- Plans 02-04 can import from src/actions/social.ts and src/lib/social/queries.ts with no stubs
- getCollectionComparison ready for comparison UI (Plan 04)

## Self-Check: PASSED

All 8 created files verified present. Both task commits (c4e53a3, 1d2e1e4) verified in git log.

---
*Phase: 05-social-layer*
*Completed: 2026-03-26*
