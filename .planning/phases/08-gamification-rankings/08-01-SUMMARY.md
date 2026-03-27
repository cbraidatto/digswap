---
phase: 08-gamification-rankings
plan: 01
subsystem: gamification
tags: [leaderboard, badges, ranking, drizzle, server-actions, postgresql]

# Dependency graph
requires:
  - phase: 01-foundation
    provides: "Database schema (gamification tables, profiles, releases, collections)"
  - phase: 04-collection-wantlist
    provides: "Collection items and releases with rarity scores"
  - phase: 07-community-reviews
    provides: "Reviews, groups, activity feed for contribution scoring"
provides:
  - "RANK_TITLES, CONTRIBUTION_POINTS, BADGE_DEFINITIONS constants"
  - "getRankTitleFromScore and computeGlobalScore pure functions"
  - "awardBadge(userId, slug) idempotent badge utility with notification"
  - "getGlobalLeaderboard, getGenreLeaderboard Drizzle query functions"
  - "getUserRanking, getUserBadges single-user data fetchers"
  - "Server action wrappers for leaderboard client components"
  - "Badge seed script for 6 milestone badges"
  - "Schema: INSERT policy on user_rankings, unique constraint on user_badges"
affects: [08-02-trigger-wiring, 08-03-leaderboard-ui, 08-04-profile-badges-ui, 08-05-rank-recalculation]

# Tech tracking
tech-stack:
  added: []
  patterns: ["Supabase admin client for badge awards (bypasses RLS)", "Raw SQL via db.execute for genre leaderboard with ROW_NUMBER window function", "Pure functions tested without mocking in Wave 0 scaffold"]

key-files:
  created:
    - src/lib/gamification/constants.ts
    - src/lib/gamification/badge-awards.ts
    - src/lib/gamification/queries.ts
    - src/actions/gamification.ts
    - src/lib/db/seeds/badge-definitions.ts
    - tests/unit/gamification/ranking-computation.test.ts
    - drizzle/0002_aberrant_pyro.sql
  modified:
    - src/lib/db/schema/gamification.ts

key-decisions:
  - "computeGlobalScore extracted as pure function for testability and reuse across ranking system"
  - "Genre leaderboard uses raw SQL with ROW_NUMBER() window function for per-genre ranking without Redis"
  - "Badge award uses Supabase admin client (not Drizzle) for consistency with existing notification pattern"

patterns-established:
  - "Wave 0 test scaffold: pure function tests without mocking for gamification constants"
  - "Genre leaderboard via raw SQL (db.execute) for complex aggregation queries not expressible in Drizzle builder"

requirements-completed: [GAME-01, GAME-02, GAME-03, GAME-04, GAME-06]

# Metrics
duration: 4min
completed: 2026-03-27
---

# Phase 8 Plan 1: Gamification Data Layer Summary

**Ranking constants, badge award utility, leaderboard queries, server actions, and Wave 0 test scaffold with 15 passing tests**

## Performance

- **Duration:** 4 min
- **Started:** 2026-03-27T16:38:12Z
- **Completed:** 2026-03-27T16:42:37Z
- **Tasks:** 2
- **Files modified:** 9

## Accomplishments
- 15 Wave 0 tests covering rank title boundaries, contribution point values, global score formula, badge definitions, and rank tier ordering
- Complete gamification library: constants, badge awards, leaderboard/ranking queries, server actions
- Schema hardened with INSERT policy on user_rankings and unique constraint on user_badges for idempotent badge awards
- Badge seed script for 6 milestone badges following existing genre-groups.ts pattern

## Task Commits

Each task was committed atomically:

1. **Task 1: Wave 0 test scaffold + gamification constants** - `afca28b` (test)
2. **Task 2: Badge utility, queries, server actions, schema, migration, seed** - `e7a0f58` (feat)

## Files Created/Modified
- `src/lib/gamification/constants.ts` - RANK_TITLES, CONTRIBUTION_POINTS, BADGE_DEFINITIONS, getRankTitleFromScore, computeGlobalScore
- `src/lib/gamification/badge-awards.ts` - awardBadge(userId, slug) idempotent badge utility with notification
- `src/lib/gamification/queries.ts` - getGlobalLeaderboard, getGenreLeaderboard, getUserRanking, getUserBadges, count functions
- `src/actions/gamification.ts` - Server action wrappers: loadGlobalLeaderboard, loadGenreLeaderboard, counts
- `src/lib/db/schema/gamification.ts` - Added INSERT policy on user_rankings, unique constraint on user_badges
- `src/lib/db/seeds/badge-definitions.ts` - Seed script for 6 badge definitions
- `drizzle/0002_aberrant_pyro.sql` - Drizzle-generated migration for schema changes
- `tests/unit/gamification/ranking-computation.test.ts` - Wave 0 scaffold: 15 tests for pure gamification functions

## Decisions Made
- Extracted `computeGlobalScore` as a standalone pure function (not just inline in queries) so both the query layer and future ranking recalculation job can share the same formula
- Genre leaderboard uses raw SQL via `db.execute` because the query involves `ROW_NUMBER() OVER`, `@>` array containment, and `LN()` aggregation that Drizzle's query builder cannot express
- Badge award uses Supabase admin client (same as community.ts inviteUserAction pattern) rather than Drizzle, maintaining consistency with the existing notification insertion pattern

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required.

## Known Stubs

None - all functions are fully implemented with real database queries. Badge seed script is runnable. Constants are production values per design decisions D-01 through D-09.

## Next Phase Readiness
- Gamification data layer complete, ready for trigger wiring (08-02) to connect badge awards to user actions
- Leaderboard queries ready for UI consumption in plans 08-03 and 08-04
- Constants and pure functions tested and verified for use in ranking recalculation (08-05)

## Self-Check: PASSED

All 7 created files verified present. Both task commits (afca28b, e7a0f58) verified in git log.

---
*Phase: 08-gamification-rankings*
*Completed: 2026-03-27*
