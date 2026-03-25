---
phase: 04-collection-management
plan: 01
subsystem: database, api
tags: [drizzle, zod, supabase, discogs, rarity, server-actions, collection]

# Dependency graph
requires:
  - phase: 03-discogs-integration
    provides: "Discogs OAuth, import worker with upsertRelease pattern, releases + collection_items tables populated"
provides:
  - "Rarity tier mapping (getRarityTier, getRarityBadgeVariant) for UI badges"
  - "Collection filter/sort schemas (DECADES, CONDITION_GRADES, collectionFilterSchema)"
  - "Server-side collection query helpers (getCollectionPage, getCollectionCount, getUniqueGenres, getUniqueFormats)"
  - "Server actions for collection management (searchDiscogs, addRecordToCollection, updateConditionGrade)"
  - "Username column on profiles table with migration and data migration script"
  - "Uncapped rarity score formula (want/have ratio, no Math.min cap)"
  - "Wave 0 test scaffolds for Plans 02-04"
  - "shadcn Popover component installed"
affects: [04-02, 04-03, 04-04, 05-social-features]

# Tech tracking
tech-stack:
  added: [shadcn-popover]
  patterns: [collection-query-join-pattern, rarity-tier-mapping, filter-schema-zod-validation, server-action-idor-prevention]

key-files:
  created:
    - src/lib/collection/rarity.ts
    - src/lib/collection/filters.ts
    - src/lib/collection/queries.ts
    - src/actions/collection.ts
    - scripts/migrate-usernames.ts
    - src/components/ui/popover.tsx
    - tests/unit/lib/collection/rarity.test.ts
    - tests/unit/lib/collection/filters.test.ts
    - tests/unit/components/collection/collection-grid.test.tsx
    - tests/unit/components/collection/add-record-dialog.test.tsx
    - tests/integration/collection/add-record.test.ts
    - tests/integration/collection/condition.test.ts
    - tests/integration/collection/public-profile.test.ts
    - tests/integration/collection/sort.test.ts
    - drizzle/0000_wandering_lord_hawal.sql
  modified:
    - src/lib/db/schema/users.ts
    - src/lib/discogs/client.ts

key-decisions:
  - "Uncapped rarity formula: removed Math.min(1.0) to allow scores >= 2.0 for Ultra Rare tier"
  - "Username column nullable initially to support existing profiles, with one-time migration script"
  - "IDOR prevention in updateConditionGrade via .eq('user_id', user.id) ownership check"
  - "Collection queries use Drizzle db client with innerJoin, not Supabase client"

patterns-established:
  - "Rarity tier mapping: getRarityTier() converts numeric score to Ultra Rare/Rare/Common/null"
  - "Collection filter schema: Zod validation with defaults for sort=rarity, page=1"
  - "Collection query pattern: innerJoin collectionItems with releases, apply WHERE conditions, ORDER BY mapping"
  - "Server action IDOR pattern: always include .eq('user_id', user.id) on mutation queries"

requirements-completed: [COLL-01, COLL-02, COLL-03, COLL-04, COLL-05, COLL-06]

# Metrics
duration: 5min
completed: 2026-03-25
---

# Phase 4 Plan 01: Data Layer Foundation Summary

**Collection data layer with uncapped rarity scoring, Drizzle query helpers with join/filter/sort/pagination, three server actions (search/add/condition), and 27 Wave 0 test stubs**

## Performance

- **Duration:** 5 min
- **Started:** 2026-03-25T22:10:58Z
- **Completed:** 2026-03-25T22:16:35Z
- **Tasks:** 2
- **Files modified:** 17

## Accomplishments
- Fixed computeRarityScore to return raw want/have ratio without 1.0 cap, enabling Ultra Rare tier (>= 2.0)
- Added username column to profiles table with Drizzle migration and one-time data migration script
- Built complete collection utility library: rarity tiers, filter/sort schemas, paginated query helpers
- Created three server actions with auth checks and IDOR prevention for collection management
- Scaffolded 27 test.todo() stubs across 8 test files for Wave 0 test coverage
- Installed shadcn Popover component for condition grade editing in Plan 03

## Task Commits

Each task was committed atomically:

1. **Task 1: Schema migration, rarity fix, and collection utility library** - `2c6aff3` (feat)
2. **Task 2: Server actions and Wave 0 test scaffolds** - `3227adb` (feat)

## Files Created/Modified
- `src/lib/db/schema/users.ts` - Added username column (varchar 30, unique) to profiles table
- `src/lib/discogs/client.ts` - Removed Math.min(1.0) cap from computeRarityScore
- `src/lib/collection/rarity.ts` - Rarity tier mapping (getRarityTier, getRarityBadgeVariant)
- `src/lib/collection/filters.ts` - DECADES, CONDITION_GRADES, SORT_OPTIONS, collectionFilterSchema
- `src/lib/collection/queries.ts` - getCollectionPage, getCollectionCount, getUniqueGenres, getUniqueFormats
- `src/actions/collection.ts` - searchDiscogs, addRecordToCollection, updateConditionGrade server actions
- `scripts/migrate-usernames.ts` - One-time data migration for generating usernames from displayName
- `src/components/ui/popover.tsx` - shadcn Popover component (installed via CLI)
- `drizzle/0000_wandering_lord_hawal.sql` - Full schema migration including username column
- `tests/unit/lib/collection/rarity.test.ts` - 9 test.todo() stubs for rarity mapping
- `tests/unit/lib/collection/filters.test.ts` - 5 test.todo() stubs for filter schemas
- `tests/unit/components/collection/collection-grid.test.tsx` - 4 test.todo() stubs for grid component
- `tests/unit/components/collection/add-record-dialog.test.tsx` - 4 test.todo() stubs for add dialog
- `tests/integration/collection/add-record.test.ts` - 4 test.todo() stubs for add record action
- `tests/integration/collection/condition.test.ts` - 3 test.todo() stubs for condition grading
- `tests/integration/collection/public-profile.test.ts` - 2 test.todo() stubs for public profile
- `tests/integration/collection/sort.test.ts` - 4 test.todo() stubs for collection sorting

## Decisions Made
- Removed Math.min(1.0) cap from computeRarityScore to allow scores >= 2.0 for Ultra Rare tier (per D-12)
- Username column is nullable initially -- existing profiles get usernames via one-time migration script
- Collection queries use Drizzle db client with innerJoin (not Supabase client) for consistency with established patterns
- IDOR prevention in updateConditionGrade uses .eq("user_id", user.id) to ensure ownership

## Deviations from Plan

None - plan executed exactly as written.

## Known Stubs

None - all artifacts are fully implemented utility libraries, server actions, and test scaffolds (test.todo() stubs are intentional Wave 0 scaffolds per plan specification).

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- All data layer utilities ready for Plan 02 (collection page components and routing)
- Server actions ready for Plan 03 (Add Record dialog and condition grading UI)
- Filter schemas and query helpers ready for Plan 04 (filter/sort UI integration)
- Drizzle migration generated and ready to apply to database

## Self-Check: PASSED

- All 15 created files verified present on disk
- Both task commits (2c6aff3, 3227adb) verified in git history
- 27 test.todo() stubs confirmed running (6 test files, 0 failures)

---
*Phase: 04-collection-management*
*Completed: 2026-03-25*
