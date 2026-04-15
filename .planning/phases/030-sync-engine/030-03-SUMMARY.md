---
phase: 030-sync-engine
plan: 03
subsystem: database
tags: [drizzle, soft-delete, collection, rarity, gems, discovery]

requires:
  - phase: 030-01
    provides: deletedAt column on collection_items schema
  - phase: 030-02
    provides: desktop sync manager with deletion detection
provides:
  - "Soft-deleted items invisible across all user-facing queries"
  - "Local-only releases excluded from rarity/gem scoring"
  - "Re-adding soft-deleted items allowed (duplicate check updated)"
affects: [gamification, discovery, radar, profile, trades, export]

tech-stack:
  added: []
  patterns:
    - "isNull(collectionItems.deletedAt) as standard filter in all collection queries"
    - "buildWhereConditions choke point pattern for centralized filtering"

key-files:
  created: []
  modified:
    - apps/web/src/lib/collection/queries.ts
    - apps/web/src/lib/social/comparison.ts
    - apps/web/src/lib/discovery/queries.ts
    - apps/web/src/lib/discovery/who-has-it.ts
    - apps/web/src/lib/wantlist/radar-queries.ts
    - apps/web/src/lib/wantlist/intersection-queries.ts
    - apps/web/src/lib/release/queries.ts
    - apps/web/src/lib/gems/queries.ts
    - apps/web/src/lib/trades/proposal-queries.ts
    - apps/web/src/actions/collection.ts
    - apps/web/src/actions/profile.ts
    - apps/web/src/actions/social.ts
    - apps/web/src/actions/export.ts
    - apps/web/src/actions/engagement.ts
    - apps/web/src/actions/wrapped.ts
    - apps/web/src/actions/wantlist.ts

key-decisions:
  - "isNull filter added to buildWhereConditions as second condition after userId (choke point covers all collection page queries)"
  - "Local-only releases (discogs_id IS NULL) excluded from gem distribution and gem score queries"
  - "Duplicate checks in addRecordToCollection and markAsFound updated with .is('deleted_at', null) to allow re-adding soft-deleted items"

patterns-established:
  - "D-03: All collection_items SELECT queries must include deleted_at IS NULL filter"
  - "D-04: Rarity/leaderboard scoring queries must include discogs_id IS NOT NULL filter"

requirements-completed: [SYNC-03, SYNC-02]

duration: 14min
completed: 2026-04-15
---

# Phase 030 Plan 03: Soft-Delete Filters Summary

**isNull(deletedAt) filter added to 19 files across collection queries, discovery, radar, comparison, gems, stats, and trade queries; local-only releases excluded from gem scoring**

## Performance

- **Duration:** 14 min
- **Started:** 2026-04-15T01:53:33Z
- **Completed:** 2026-04-15T02:07:33Z
- **Tasks:** 1 of 2 (Task 2 is human-verify checkpoint)
- **Files modified:** 25 (19 source + 6 test)

## Accomplishments
- Soft-deleted collection items invisible on profile, discovery, radar, rankings, comparison, export, and stats
- Local-only releases (discogs_id IS NULL) excluded from gem distribution and gem score calculations
- Duplicate checks updated so soft-deleted items don't block re-adding records
- All 1568 tests passing with updated mocks

## Task Commits

1. **Task 1: Add deletedAt IS NULL filter to all collection queries** - `9f00197` (feat)
2. **Task 2: Verify full desktop-to-web sync flow** - PENDING (human-verify checkpoint)

## Files Created/Modified
- `apps/web/src/lib/collection/queries.ts` - isNull filter in buildWhereConditions choke point + getUniqueGenres/getTopGenres/getUniqueFormats
- `apps/web/src/lib/social/comparison.ts` - Filter on all 3 comparison queries + NOT EXISTS subqueries
- `apps/web/src/lib/discovery/queries.ts` - Filter on searchRecords owners, browseRecords, getSuggestedRecords, getTrendingRecords, notOwnedExpr
- `apps/web/src/lib/discovery/who-has-it.ts` - Filter on findWhoHasRelease
- `apps/web/src/lib/wantlist/radar-queries.ts` - Filter on radar match query
- `apps/web/src/lib/wantlist/intersection-queries.ts` - Filter on wantlist intersections and compatibility score
- `apps/web/src/lib/release/queries.ts` - Filter on getOwnersByReleaseId and getOwnerCountByReleaseId
- `apps/web/src/lib/gems/queries.ts` - deleted_at IS NULL + discogs_id IS NOT NULL in gem distribution/score
- `apps/web/src/lib/trades/proposal-queries.ts` - Filter on getTradeableCollectionItems
- `apps/web/src/actions/collection.ts` - .is('deleted_at', null) on duplicate check + badge count
- `apps/web/src/actions/profile.ts` - isNull filter on showcase search
- `apps/web/src/actions/social.ts` - deleted_at IS NULL in record count subquery
- `apps/web/src/actions/export.ts` - Filter on CSV export query
- `apps/web/src/actions/engagement.ts` - Filter on digger DNA computation
- `apps/web/src/actions/wrapped.ts` - Filter on wrapped stats query
- `apps/web/src/actions/wantlist.ts` - .is('deleted_at', null) on markAsFound duplicate check
- `apps/web/src/app/(protected)/(profile)/perfil/page.tsx` - Filter on weekly adds count
- `apps/web/src/app/(protected)/(profile)/perfil/stats/page.tsx` - Filter on all 5 stats queries
- `apps/web/src/app/(protected)/(profile)/perfil/[username]/compare/page.tsx` - Filter on collection existence check

## Decisions Made
- isNull filter added as second condition in buildWhereConditions (after userId), making it impossible to forget for any query using the choke point
- Local-only releases excluded from gem scoring per D-04 (they have no Discogs rarity data)
- Supabase admin client queries use `.is('deleted_at', null)` syntax (PostgREST IS NULL filter)
- Comparison NOT EXISTS subqueries also filter `b.deleted_at IS NULL` to prevent counting soft-deleted items in the other user's collection

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Updated test mocks to include isNull export**
- **Found during:** Task 1 (verification step)
- **Issue:** 6 test files mock drizzle-orm without isNull, causing 34 test failures
- **Fix:** Added `isNull: vi.fn()` to drizzle-orm mocks in 6 test files; added `.is()` to chain mock in add-record test
- **Files modified:** 6 test files
- **Verification:** All 1568 tests pass
- **Committed in:** 9f00197

**2. [Rule 2 - Missing Critical] Extended soft-delete filter to 14 additional files beyond plan scope**
- **Found during:** Task 1 (audit step)
- **Issue:** Plan listed 5 files but grep revealed 19+ files querying collection_items
- **Fix:** Added filter to all 19 files with SELECT queries on collection_items
- **Files modified:** 19 source files (vs 5 in plan)
- **Verification:** Comprehensive grep confirms coverage
- **Committed in:** 9f00197

---

**Total deviations:** 2 auto-fixed (1 blocking, 1 missing critical)
**Impact on plan:** Both deviations necessary for correctness. Full audit found 14 additional query sites the plan missed.

## Issues Encountered
- Plan referenced `apps/web/src/lib/gamification/ranking.ts` and `apps/web/src/lib/discovery/radar.ts` which do not exist. Actual files are `gamification/queries.ts` (reads from materialized view, no direct collection_items queries) and `wantlist/radar-queries.ts`.

## Known Stubs
None - all filters are wired to real schema columns.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- All collection queries filter soft-deleted items
- Human verification of full desktop-to-web sync flow pending (Task 2 checkpoint)

---
*Phase: 030-sync-engine*
*Completed: 2026-04-15*
