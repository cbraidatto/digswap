---
phase: 04-collection-management
plan: 02
subsystem: ui
tags: [next.js, react, tailwind, shadcn, collection-grid, filter-bar, pagination, public-profile]

# Dependency graph
requires:
  - phase: 04-collection-management
    plan: 01
    provides: "Collection queries (getCollectionPage, getCollectionCount, getUniqueGenres, getUniqueFormats), rarity utilities (getRarityTier, getRarityBadgeVariant), filter schema (collectionFilterSchema, DECADES, SORT_OPTIONS), username column on profiles"
provides:
  - "CollectionGrid component (responsive 2-4 column card grid)"
  - "CollectionCard component (cover art, title, artist, rarity badge)"
  - "FilterBar component (genre, decade, format, sort dropdowns with URL-based navigation)"
  - "Pagination component (URL-based page navigation preserving search params)"
  - "CollectionSkeleton loading placeholder"
  - "Public profile route at /perfil/[username] (no auth required)"
  - "Own profile page with real collection data (replaces Phase 2 placeholder)"
affects: [04-collection-management, 05-wantlist, 06-social-features]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "URL-based filtering with searchParams (shareable, SSR-compatible)"
    - "Public route outside (protected) group with minimal layout"
    - "Middleware exact-path matching for protecting /perfil but allowing /perfil/[username]"
    - "Parallel data fetching with Promise.all for collection page + count + genres + formats"

key-files:
  created:
    - "src/app/perfil/[username]/page.tsx"
    - "src/app/perfil/[username]/layout.tsx"
    - "src/app/(protected)/(profile)/perfil/_components/collection-card.tsx"
    - "src/app/(protected)/(profile)/perfil/_components/collection-grid.tsx"
    - "src/app/(protected)/(profile)/perfil/_components/collection-skeleton.tsx"
    - "src/app/(protected)/(profile)/perfil/_components/pagination.tsx"
    - "src/app/(protected)/(profile)/perfil/_components/filter-bar.tsx"
  modified:
    - "src/lib/supabase/middleware.ts"
    - "src/app/(protected)/(profile)/perfil/page.tsx"
    - "next.config.ts"

key-decisions:
  - "URL-based filtering over client state for shareable/bookmarkable collection URLs"
  - "Public profile layout with minimal header (no AppShell) for unauthenticated visitors"
  - "Middleware exact-path check for /perfil protection instead of removing /perfil from protectedPaths"
  - "Added Discogs image domains to next.config.ts remotePatterns for Next.js Image optimization"

patterns-established:
  - "Public vs protected route split: /perfil/[username] outside (protected), /perfil inside (protected)"
  - "FilterBar URL-navigation pattern: buildFilterUrl() constructs query strings preserving existing params"
  - "CollectionCard as client component with server-fetched data passed as props"

requirements-completed: [COLL-01, COLL-04, COLL-05]

# Metrics
duration: 4min
completed: 2026-03-25
---

# Phase 4 Plan 2: Collection Browsing UI Summary

**Responsive collection card grid with filter/sort bar, public profile route, and paginated collection display using URL-based navigation**

## Performance

- **Duration:** 4 min
- **Started:** 2026-03-25T22:20:05Z
- **Completed:** 2026-03-25T22:24:32Z
- **Tasks:** 2
- **Files modified:** 10

## Accomplishments
- Built responsive collection card grid (2-4 columns) with cover art, title, artist, and rarity badges
- Created public profile route at /perfil/[username] accessible without authentication
- Implemented FilterBar with 4 dropdown chips (Genre, Decade, Format, Sort) using shadcn DropdownMenu with URL-based navigation
- Replaced Phase 2 placeholder on own profile page with real collection data, filter bar, and pagination
- Updated middleware to protect /perfil (exact) while allowing public /perfil/[username] access

## Task Commits

Each task was committed atomically:

1. **Task 1: Public profile route, middleware update, and shared collection components** - `4827309` (feat)
2. **Task 2: Filter bar, own profile page rewrite, and Suspense integration** - `3f7ed66` (feat)

## Files Created/Modified
- `src/app/perfil/[username]/page.tsx` - Public profile page with collection grid, fetches user by username
- `src/app/perfil/[username]/layout.tsx` - Minimal public layout with CYBER-DIGGER branding and sign-in link
- `src/app/(protected)/(profile)/perfil/_components/collection-card.tsx` - Record card with cover art, rarity badge, owner edit overlay
- `src/app/(protected)/(profile)/perfil/_components/collection-grid.tsx` - Responsive grid (2-4 cols) with empty state
- `src/app/(protected)/(profile)/perfil/_components/collection-skeleton.tsx` - Loading skeleton matching grid layout
- `src/app/(protected)/(profile)/perfil/_components/pagination.tsx` - URL-based pagination with Previous/Next links
- `src/app/(protected)/(profile)/perfil/_components/filter-bar.tsx` - 4 dropdown filter chips with URL navigation
- `src/lib/supabase/middleware.ts` - Updated to allow public /perfil/[username] access
- `src/app/(protected)/(profile)/perfil/page.tsx` - Rewritten with real collection data, filters, pagination
- `next.config.ts` - Added Discogs image remote patterns for Next.js Image

## Decisions Made
- URL-based filtering with searchParams rather than client-side state -- enables shareable/bookmarkable collection URLs and SSR-compatible navigation
- Public profile layout uses minimal header (no AppShell) -- unauthenticated visitors see a clean presentation without the full navigation shell
- Middleware uses exact-path matching (pathname === "/perfil") instead of removing /perfil from the startsWith array -- cleaner, avoids accidentally unprotecting future /perfil/* authenticated routes
- Added Discogs image domains (i.discogs.com, st.discogs.com) to next.config.ts remotePatterns -- required for Next.js Image optimization of external cover art URLs

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Added Discogs image remote patterns to next.config.ts**
- **Found during:** Task 1 (CollectionCard with Next.js Image)
- **Issue:** next.config.ts had no `images.remotePatterns` configuration; Next.js Image would reject external Discogs cover art URLs at runtime
- **Fix:** Added remotePatterns for i.discogs.com and st.discogs.com
- **Files modified:** next.config.ts
- **Verification:** TypeScript compiles, configuration is valid
- **Committed in:** 4827309 (Task 1 commit)

---

**Total deviations:** 1 auto-fixed (1 blocking)
**Impact on plan:** Essential for cover art display. No scope creep.

## Issues Encountered
- Pre-existing TypeScript error: `src/components/shell/app-shell.tsx` imports `@/components/shell/sidebar` which doesn't exist. Out of scope -- not related to this plan's changes.

## User Setup Required

None - no external service configuration required.

## Known Stubs

None - all components are wired to real data sources from Plan 01 queries.

## Next Phase Readiness
- Collection browsing UI complete, ready for condition grade editing (Plan 03)
- FilterBar and CollectionGrid components are reusable for any collection display
- Public profile route establishes pattern for social features (Phase 6)

## Self-Check: PASSED

All 10 created/modified files verified present. Both task commits (4827309, 3f7ed66) verified in git log.

---
*Phase: 04-collection-management*
*Completed: 2026-03-25*
