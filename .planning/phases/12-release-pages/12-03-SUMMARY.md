---
phase: 12-release-pages
plan: 03
subsystem: ui
tags: [next-link, view-release, vitest, unit-tests, youtube-api, drizzle]

# Dependency graph
requires:
  - phase: 12-release-pages plan 01
    provides: Release query functions, YouTube server action, discogsId on SearchResult/RadarMatch interfaces
  - phase: 04-collection-profile
    provides: CollectionCard component, CollectionItem interface with discogsId
  - phase: 06-discovery-notifications
    provides: RecordSearchCard component, SearchResult interface
  - phase: 10-positioning-radar-workspace
    provides: RadarSection component, RadarMatch interface
provides:
  - VIEW_RELEASE entry point links from CollectionCard, RecordSearchCard, and RadarSection
  - Unit test suite for release queries (6 tests), YouTube search (7 tests), reviews integration (4 tests)
affects: [12-release-pages plan 02 (release page route is now discoverable from all surfaces)]

# Tech tracking
tech-stack:
  added: []
  patterns: [vi.hoisted() for mock variable declarations used in vi.mock factories]

key-files:
  created:
    - tests/unit/release/release-queries.test.ts
    - tests/unit/release/youtube-search.test.ts
    - tests/unit/release/release-reviews.test.ts
  modified:
    - src/app/(protected)/(profile)/perfil/_components/collection-card.tsx
    - src/app/(protected)/(explore)/explorar/_components/record-search-card.tsx
    - src/app/(protected)/(feed)/feed/_components/radar-section.tsx

key-decisions:
  - "Used vi.hoisted() pattern for YouTube search test mocks to avoid vi.mock hoisting issues with module-scope variables"
  - "RadarSection uses album icon (not VIEW_RELEASE text) for compact actions area per plan specification"

patterns-established:
  - "vi.hoisted() for mock variables referenced inside vi.mock factories -- avoids 'Cannot access before initialization' errors"

requirements-completed: [REL-01, REL-03, REL-04, REL-05]

# Metrics
duration: 4min
completed: 2026-03-29
---

# Phase 12 Plan 03: Entry Point Links + Release Unit Test Suite Summary

**VIEW_RELEASE links wired from CollectionCard, RecordSearchCard, and RadarSection to /release/[discogsId] with 17 unit tests covering release queries, YouTube lazy-cache, and reviews integration**

## Performance

- **Duration:** 4 min
- **Started:** 2026-03-29T01:06:52Z
- **Completed:** 2026-03-29T01:10:59Z
- **Tasks:** 2
- **Files modified:** 6

## Accomplishments
- Wired VIEW_RELEASE entry points from all three existing record surfaces (CollectionCard, RecordSearchCard, RadarSection) to /release/[discogsId]
- Created comprehensive unit test suite with 17 tests covering all release data layer functions
- Tests cover cache hit/miss, API errors, auth gating, rate limiting, query shapes, and pagination

## Task Commits

Each task was committed atomically:

1. **Task 1: Add VIEW_RELEASE links to CollectionCard, RecordSearchCard, and RadarSection** - `ebf80a1` (feat)
2. **Task 2: Unit tests for release queries, YouTube search, and reviews integration** - `dc63165` (test)

## Files Created/Modified
- `src/app/(protected)/(profile)/perfil/_components/collection-card.tsx` - Added VIEW_RELEASE link after artist, before ConditionEditor
- `src/app/(protected)/(explore)/explorar/_components/record-search-card.tsx` - Added VIEW_RELEASE link after metadata row
- `src/app/(protected)/(feed)/feed/_components/radar-section.tsx` - Added album icon link in match card actions area
- `tests/unit/release/release-queries.test.ts` - 6 tests for getReleaseByDiscogsId, getOwnersByReleaseId, getOwnerCountByReleaseId
- `tests/unit/release/youtube-search.test.ts` - 7 tests for searchYouTubeForRelease (cache, API, auth, rate limiting)
- `tests/unit/release/release-reviews.test.ts` - 4 tests for getReviewsForRelease and getReviewCountForRelease integration

## Decisions Made
- Used `vi.hoisted()` for YouTube search test mock variables to avoid vi.mock factory hoisting issues (first occurrence of this pattern in the codebase)
- RadarSection uses a compact album Material Symbol icon link instead of the text "VIEW_RELEASE" to fit the existing actions area layout

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Fixed vi.mock hoisting issue in youtube-search.test.ts**
- **Found during:** Task 2 (YouTube search tests)
- **Issue:** `mockRateLimitFn` and other mock variables declared with `const` were referenced inside `vi.mock()` factories, but `vi.mock` is hoisted above variable declarations causing "Cannot access before initialization" error
- **Fix:** Used `vi.hoisted()` to create all mock functions in a hoisted scope, then referenced them inside `vi.mock()` factories
- **Files modified:** tests/unit/release/youtube-search.test.ts
- **Verification:** All 7 YouTube search tests pass
- **Committed in:** dc63165 (Task 2 commit)

---

**Total deviations:** 1 auto-fixed (1 blocking)
**Impact on plan:** Standard test infrastructure fix. No scope creep.

## Issues Encountered

None beyond the vi.mock hoisting issue (documented above as deviation).

## Known Stubs

None - all links are wired to real routes, all tests exercise real function signatures.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- All three entry point surfaces now link to /release/[discogsId]
- 17 unit tests validate the data layer created in Plan 01
- Plan 02 (release page route) is the remaining piece to make links resolve to actual pages

## Self-Check: PASSED

- All 6 files verified (3 created, 3 modified)
- Both task commits found (ebf80a1, dc63165)

---
*Phase: 12-release-pages*
*Completed: 2026-03-29*
