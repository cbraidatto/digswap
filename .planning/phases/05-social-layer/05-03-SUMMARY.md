---
phase: 05-social-layer
plan: 03
subsystem: ui
tags: [react, next.js, useOptimistic, follow-system, search, server-actions, social]

# Dependency graph
requires:
  - phase: 05-01
    provides: "follows table, social queries (getFollowCounts, checkIsFollowing, getFollowers, getFollowing), server actions (followUser, unfollowUser, searchUsers)"
provides:
  - "Public profile route /perfil/[username] with collection grid and follow/compare buttons"
  - "FollowButton client component with useOptimistic for instant follow/unfollow toggle"
  - "FollowList expandable inline component for follower/following lists"
  - "SearchSection with debounced username search on /explorar"
  - "fetchFollowersList and fetchFollowingList server action wrappers"
affects: [05-04, 06-collection-comparison, social-discovery]

# Tech tracking
tech-stack:
  added: []
  patterns: ["useOptimistic for optimistic server action UI", "300ms debounce with setTimeout/clearTimeout ref pattern", "server action wrappers for query functions (client components cannot call query functions directly)"]

key-files:
  created:
    - "src/app/(protected)/(profile)/perfil/[username]/page.tsx"
    - "src/app/(protected)/(profile)/perfil/[username]/_components/profile-header.tsx"
    - "src/app/(protected)/(profile)/perfil/[username]/_components/follow-button.tsx"
    - "src/app/(protected)/(profile)/perfil/_components/follow-list.tsx"
    - "src/app/(protected)/(explore)/explorar/_components/search-section.tsx"
  modified:
    - "src/app/(protected)/(profile)/perfil/page.tsx"
    - "src/app/(protected)/(explore)/explorar/page.tsx"
    - "src/actions/social.ts"

key-decisions:
  - "useOptimistic from React 19 for follow/unfollow instant UI toggle with automatic revert on error"
  - "Server action wrappers (fetchFollowersList/fetchFollowingList) for client component access to query functions"
  - "Cross-directory FollowButton import from search-section to /perfil/[username]/_components for reuse"

patterns-established:
  - "useOptimistic pattern: optimistic state + useTransition + server action + toast on error"
  - "Expandable inline list: click count text to toggle list, lazy-load on first expand"
  - "Debounced search: 300ms setTimeout/clearTimeout ref pattern consistent with Phase 4 Discogs search"

requirements-completed: [SOCL-01, SOCL-02, SOCL-05]

# Metrics
duration: 5min
completed: 2026-03-26
---

# Phase 5 Plan 03: Public Profiles, Follow UI, and Username Search Summary

**Public profile pages with optimistic follow/unfollow via useOptimistic, expandable follower lists on own profile, and debounced username search on /explorar**

## Performance

- **Duration:** 5 min
- **Started:** 2026-03-26T03:07:46Z
- **Completed:** 2026-03-26T03:12:34Z
- **Tasks:** 2
- **Files modified:** 8

## Accomplishments
- Public profile route at /perfil/[username] renders target user's collection with reused CollectionGrid, FilterBar, Pagination
- FollowButton with useOptimistic provides instant toggle between FOLLOW/FOLLOWING/UNFOLLOW states with hover interaction
- Own profile at /perfil now displays follower/following counts with expandable inline lists
- /explorar page has functional username search with 300ms debounce, result cards with inline Follow buttons

## Task Commits

Each task was committed atomically:

1. **Task 1: Build public profile route with ProfileHeader and FollowButton** - `d868d89` (feat)
2. **Task 2: Add FollowList to own profile and username search to Explorar** - `c27fab4` (feat)

## Files Created/Modified
- `src/app/(protected)/(profile)/perfil/[username]/page.tsx` - Public profile server component with parallel data fetching, self-redirect, 404 handling
- `src/app/(protected)/(profile)/perfil/[username]/_components/profile-header.tsx` - Profile header with avatar, bio, counts, Follow and Compare buttons
- `src/app/(protected)/(profile)/perfil/[username]/_components/follow-button.tsx` - Client component with useOptimistic for instant follow/unfollow toggle
- `src/app/(protected)/(profile)/perfil/_components/follow-list.tsx` - Expandable inline follower/following list with lazy loading
- `src/app/(protected)/(explore)/explorar/_components/search-section.tsx` - Debounced username search with results and inline Follow buttons
- `src/app/(protected)/(profile)/perfil/page.tsx` - Added getFollowCounts and FollowList to own profile
- `src/app/(protected)/(explore)/explorar/page.tsx` - Replaced placeholder search hero with SearchSection
- `src/actions/social.ts` - Added fetchFollowersList/fetchFollowingList server action wrappers

## Decisions Made
- Used React 19 useOptimistic (project ships React 19.1.0 despite CLAUDE.md documenting React 18.x) for instant follow/unfollow toggle with automatic revert on error
- Created thin server action wrappers (fetchFollowersList/fetchFollowingList) since client components cannot directly import query functions from lib/
- Imported FollowButton cross-directory from search-section to avoid duplicating the component

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Public profiles with follow/unfollow are live, ready for collection comparison (Plan 04)
- FollowButton is reusable across any surface that needs follow interaction
- SearchSection pattern can be extended for record search in Phase 6

## Self-Check: PASSED

- All 5 created files verified on disk
- Both task commits (d868d89, c27fab4) verified in git log
- All 194 tests pass with 0 failures

---
*Phase: 05-social-layer*
*Completed: 2026-03-26*
