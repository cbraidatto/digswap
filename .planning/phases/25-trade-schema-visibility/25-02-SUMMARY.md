---
phase: 25-trade-schema-visibility
plan: 02
subsystem: api
tags: [server-actions, drizzle, collection, visibility, quality-metadata, trade]

# Dependency graph
requires:
  - phase: 25-trade-schema-visibility
    plan: 01
    provides: visibility column, audio quality metadata columns on collection_items
  - phase: 04-collection-management
    provides: collection actions pattern (toggleOpenForTrade, updateConditionGrade)
provides:
  - setVisibility server action (tradeable/not_trading/private)
  - updateQualityMetadata server action (audioFormat, bitrate, sampleRate)
  - CollectionItem type extended with visibility + quality fields
  - getCollectionPage fetches visibility + quality columns
  - excludePrivate option for cross-user queries (defense-in-depth)
  - CollectionFilters visibility filter support
  - toggleOpenForTrade backward compat via delegation to setVisibility
affects: [25-03, trade-ui, collection-ui, profile-page]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Visibility delegation: toggleOpenForTrade delegates to setVisibility for backward compat"
    - "Defense-in-depth: excludePrivate WHERE filter for Drizzle queries that bypass RLS"
    - "Quality metadata partial update: only update provided fields via dynamic payload"

key-files:
  created:
    - apps/web/src/tests/collection/visibility-actions.test.ts
    - apps/web/src/tests/collection/collection-types.test.ts
  modified:
    - apps/web/src/actions/collection.ts
    - apps/web/src/lib/collection/queries.ts
    - apps/web/src/lib/collection/filters.ts
    - apps/web/tests/unit/components/collection/collection-grid.test.tsx

key-decisions:
  - "toggleOpenForTrade delegates to setVisibility internally rather than being removed -- preserves backward compat for existing UI until Plan 03 updates components"
  - "updateQualityMetadata uses dynamic payload (only update provided fields) to support partial updates"
  - "excludePrivate option on getCollectionPage for defense-in-depth since Drizzle db client bypasses RLS"
  - "VISIBILITY_OPTIONS constant exported from filters.ts for reuse in UI components"

patterns-established:
  - "Visibility delegation: deprecated action delegates to new action for zero-disruption migration"
  - "Defense-in-depth query options: optional excludePrivate flag for cross-user queries that bypass RLS"

requirements-completed: [TRD-01, TRD-02]

# Metrics
duration: 7min
completed: 2026-04-09
---

# Phase 25 Plan 02: Visibility Actions + Query Layer Summary

**Server actions for three-state collection visibility (tradeable/not_trading/private) and audio quality metadata, with backward-compatible toggleOpenForTrade delegation and 24 passing tests**

## Performance

- **Duration:** 7 min
- **Started:** 2026-04-09T16:21:47Z
- **Completed:** 2026-04-09T16:28:58Z
- **Tasks:** 2
- **Files modified:** 6

## Accomplishments
- Added setVisibility server action with enum validation, IDOR prevention, and rate limiting
- Added updateQualityMetadata server action for audio format, bitrate, and sample rate with partial update support
- Extended CollectionItem type and getCollectionPage with visibility + quality metadata fields
- Updated CollectionFilters with optional visibility filter (tradeable/not_trading/private/all)
- toggleOpenForTrade now delegates to setVisibility for zero-disruption backward compatibility
- 24 tests passing across type verification and action behavior

## Task Commits

Each task was committed atomically:

1. **Task 1: Update CollectionItem type and getCollectionPage** - `be11c66` (feat)
2. **Task 2: Add setVisibility and updateQualityMetadata actions** - `a6878b6` (feat)

**Plan metadata:** pending

_Note: TDD tasks have additional RED-phase commits (904252c, 3f77959)_

## Files Created/Modified
- `apps/web/src/actions/collection.ts` - Added setVisibility, updateQualityMetadata; toggleOpenForTrade now delegates
- `apps/web/src/lib/collection/queries.ts` - CollectionItem type extended; getCollectionPage selects new columns; excludePrivate option
- `apps/web/src/lib/collection/filters.ts` - VISIBILITY_OPTIONS constant; collectionFilterSchema gains optional visibility field
- `apps/web/src/tests/collection/visibility-actions.test.ts` - 14 unit tests for new server actions
- `apps/web/src/tests/collection/collection-types.test.ts` - 10 type and filter validation tests
- `apps/web/tests/unit/components/collection/collection-grid.test.tsx` - Updated makeItem with new required fields

## Decisions Made
- toggleOpenForTrade delegates to setVisibility internally rather than being removed, preserving backward compat for existing UI components until Plan 03 updates them
- updateQualityMetadata uses a dynamic payload that only updates provided fields, supporting partial metadata updates
- getCollectionPage accepts an optional excludePrivate option as defense-in-depth for cross-user queries (Drizzle db client bypasses RLS)
- VISIBILITY_OPTIONS exported as const array from filters.ts for reuse in UI dropdowns (Plan 03)

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Updated collection-grid test to include new required fields**
- **Found during:** Task 1 (CollectionItem type extension)
- **Issue:** Existing collection-grid.test.tsx had makeItem() factory missing new required visibility/audioFormat/bitrate/sampleRate fields, causing TypeScript errors
- **Fix:** Added visibility: "not_trading", audioFormat: null, bitrate: null, sampleRate: null to makeItem defaults
- **Files modified:** apps/web/tests/unit/components/collection/collection-grid.test.tsx
- **Verification:** tsc --noEmit reports zero collection-related errors
- **Committed in:** be11c66 (Task 1 commit)

---

**Total deviations:** 1 auto-fixed (1 blocking)
**Impact on plan:** Auto-fix necessary for type safety. No scope creep.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required.

## Known Stubs

None - all data paths are wired to real database columns from Plan 01 schema.

## Next Phase Readiness
- Server actions ready for UI consumption in Plan 03 (visibility controls, quality metadata editor)
- CollectionItem type provides all fields needed for trade proposal UI
- excludePrivate option available for public profile and cross-user collection views

## Self-Check: PASSED

- All 6 key files exist
- Both task commits (be11c66, a6878b6) verified in git log
- 24 tests pass (10 type/filter + 14 action)
- Zero collection-related TypeScript errors

---
*Phase: 25-trade-schema-visibility*
*Completed: 2026-04-09*
