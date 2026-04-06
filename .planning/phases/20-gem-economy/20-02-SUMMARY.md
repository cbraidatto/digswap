---
phase: 20-gem-economy
plan: 02
subsystem: gamification
tags: [postgresql, sql, ranking, leaderboard, gem-economy, vitest]

# Dependency graph
requires:
  - phase: 08-gamification
    provides: Original ranking function, gamification constants, leaderboard queries
  - phase: 20-gem-economy plan 01
    provides: Gem tier definitions and mapping constants
provides:
  - Updated recalculate_rankings() SQL function with gem weight CASE expression
  - Updated genre_leaderboard_mv with gem weight scoring
  - Recalibrated RANK_TITLES thresholds for gem score scale (501/2001/5001)
  - Updated computeGlobalScore with gemScore parameter
  - Updated UserRanking interface with gemScore field
  - Updated rare_find badge description referencing Safira/Diamante
affects: [20-gem-economy plan 03 (consumer updates), profile pages, leaderboard UI]

# Tech tracking
tech-stack:
  added: []
  patterns: [gem weight CASE expression in SQL, DB column semantic remapping via TS interface]

key-files:
  created:
    - supabase/migrations/20260406_gem_ranking_function.sql
  modified:
    - apps/web/src/lib/gamification/constants.ts
    - apps/web/src/lib/gamification/queries.ts
    - apps/web/tests/unit/gamification/ranking-computation.test.ts
    - apps/web/tests/unit/gamification/profile-ranking.test.ts
    - apps/web/tests/unit/gamification/leaderboard-queries.test.ts

key-decisions:
  - "Reuse rarity_score DB column for gem scores (no schema migration) -- semantic rename at TS layer only"
  - "RANK_TITLES recalibrated to 501/2001/5001 based on typical 200-record collection yielding ~1030 gem score"
  - "UserRanking.rarityScore renamed to gemScore -- breaking change for consumers, resolved in Plan 03"

patterns-established:
  - "Gem weight CASE expression: >= 6.0 THEN 100, >= 3.0 THEN 35, >= 1.5 THEN 20, >= 0.8 THEN 8, >= 0.3 THEN 3, ELSE 1"
  - "DB column semantic remapping: Drizzle schema keeps rarityScore, TS interface exposes gemScore"

requirements-completed: [GEM-03, GEM-06]

# Metrics
duration: 3min
completed: 2026-04-06
---

# Phase 20 Plan 02: Ranking & Leaderboard Gem Integration Summary

**Gem-weighted ranking SQL function replacing ln(1+rarity_score) with tiered CASE expression, recalibrated thresholds, and updated leaderboard queries**

## Performance

- **Duration:** 3 min
- **Started:** 2026-04-06T19:08:43Z
- **Completed:** 2026-04-06T19:11:56Z
- **Tasks:** 2
- **Files modified:** 6

## Accomplishments
- Replaced ln(1 + rarity_score) with gem weight CASE expression in recalculate_rankings() SQL function
- Dropped and recreated genre_leaderboard_mv with same gem weight CASE for consistency
- Recalibrated RANK_TITLES thresholds from 51/201/501 to 501/2001/5001 for gem score scale
- Updated UserRanking interface from rarityScore to gemScore with proper DB mapping
- All 41 gamification tests passing (across 4 test files)

## Task Commits

Each task was committed atomically:

1. **Task 1: Create gem ranking SQL migration and update gamification constants** - `5396df0` (feat)
2. **Task 2: Update leaderboard queries and UserRanking interface** - `4087717` (feat)

## Files Created/Modified
- `supabase/migrations/20260406_gem_ranking_function.sql` - New ranking function with gem weights + recreated genre MV
- `apps/web/src/lib/gamification/constants.ts` - computeGlobalScore gemScore param, RANK_TITLES 501/2001/5001, rare_find badge text
- `apps/web/src/lib/gamification/queries.ts` - UserRanking.gemScore interface, getUserRanking mapping
- `apps/web/tests/unit/gamification/ranking-computation.test.ts` - Updated thresholds, parameter names, badge test
- `apps/web/tests/unit/gamification/profile-ranking.test.ts` - Updated for gemScore field access
- `apps/web/tests/unit/gamification/leaderboard-queries.test.ts` - Updated comment for gem weight CASE

## Decisions Made
- Reuse rarity_score DB column for gem scores rather than adding new column -- avoids schema migration, semantic rename at TypeScript layer only
- RANK_TITLES thresholds recalibrated: a typical 200-record collection scores ~1030 gem points, so Crate Digger starts at 501 (reachable by most active collectors)
- UserRanking.rarityScore renamed to gemScore as a breaking change -- Plan 03 will update all consumers (perfil page references ranking?.rarityScore)

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Updated profile-ranking.test.ts for gemScore field**
- **Found during:** Task 2
- **Issue:** Existing profile-ranking tests accessed `result!.rarityScore` and `ranking?.rarityScore` which would fail after UserRanking interface change
- **Fix:** Updated test assertions to use `gemScore` field name
- **Files modified:** apps/web/tests/unit/gamification/profile-ranking.test.ts
- **Verification:** All 41 gamification tests pass
- **Committed in:** 4087717 (Task 2 commit)

**2. [Rule 1 - Bug] Updated leaderboard-queries.test.ts comment**
- **Found during:** Task 2
- **Issue:** Test comment referenced "SUM(LN(1 + rarity_score))" which is now outdated
- **Fix:** Updated to "SUM(gem_weight CASE)" for accuracy
- **Files modified:** apps/web/tests/unit/gamification/leaderboard-queries.test.ts
- **Committed in:** 4087717 (Task 2 commit)

---

**Total deviations:** 2 auto-fixed (2 Rule 1 bugs in test files)
**Impact on plan:** Both fixes necessary for test correctness after interface change. No scope creep.

## Known Stubs

- `apps/web/src/app/(protected)/(profile)/perfil/page.tsx:230` references `ranking?.rarityScore` which will fail TypeScript compilation after this change -- Plan 03 will update all consumers

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- SQL migration ready to apply to database
- Constants and queries updated -- Plan 03 needs to update all consumers of UserRanking.gemScore
- Profile page, about-tab, and any component accessing ranking?.rarityScore must be updated in Plan 03

---
*Phase: 20-gem-economy*
*Completed: 2026-04-06*
