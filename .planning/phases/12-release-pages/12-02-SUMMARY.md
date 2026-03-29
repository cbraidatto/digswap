---
phase: 12-release-pages
plan: 02
subsystem: ui
tags: [next.js, server-components, youtube-embed, opengraph, seo, trust-strip]

# Dependency graph
requires:
  - phase: 12-release-pages
    provides: getReleaseByDiscogsId, getOwnersByReleaseId, getOwnerCountByReleaseId, searchYouTubeForRelease, CSP frame-src
  - phase: 10-positioning-radar-workspace
    provides: TrustStrip component, public route layout pattern (perfil)
  - phase: 07-community-reviews
    provides: getReviewsForRelease, getReviewCountForRelease, ReviewItem type
provides:
  - /release/[discogsId] public route with layout, page, and 4 components
  - generateMetadata with Open Graph tags for SEO/social sharing
  - YouTube embed with privacy-enhanced mode (youtube-nocookie.com)
  - Owners section with TrustStrip compact trust ratings
  - Reviews section with cursor-based load-more pagination
  - getMoreReviews server action for client-side pagination
affects: [12-release-pages plan 03 (entry point wiring from CollectionCard, RadarMatch, RecordSearchCard)]

# Tech tracking
tech-stack:
  added: []
  patterns: [Public release route with auth-optional layout, Pre-fetched reviews passed as props to client component for initial render]

key-files:
  created:
    - src/app/release/layout.tsx
    - src/app/release/[discogsId]/page.tsx
    - src/app/release/[discogsId]/_components/release-hero.tsx
    - src/app/release/[discogsId]/_components/youtube-embed.tsx
    - src/app/release/[discogsId]/_components/owners-section.tsx
    - src/app/release/[discogsId]/_components/reviews-section.tsx
  modified:
    - src/actions/release.ts

key-decisions:
  - "Reviews pre-fetched server-side (limit 10) and passed as initialReviews to avoid client-side waterfall on first load"
  - "TrustStrip rendered inline without ts-expect-error -- async Server Component composition works natively in owners-section"
  - "VER_TODOS link is a non-navigating span placeholder for future paginated owners page"

patterns-established:
  - "Server-rendered review list with client-side load-more via server action wrapper (getMoreReviews)"
  - "Public release page pattern: layout checks auth, page fetches data via Drizzle bypassing RLS"

requirements-completed: [REL-01, REL-02, REL-03, REL-04, REL-05]

# Metrics
duration: 4min
completed: 2026-03-29
---

# Phase 12 Plan 02: Release Page Route and Components Summary

**Public /release/[discogsId] route with hero section, YouTube privacy-enhanced embed, owner cards with TrustStrip trust ratings, and paginated reviews**

## Performance

- **Duration:** 4 min
- **Started:** 2026-03-29T01:06:51Z
- **Completed:** 2026-03-29T01:10:55Z
- **Tasks:** 2
- **Files modified:** 7

## Accomplishments
- Built complete public release page route at /release/[discogsId] with auth-optional layout (AppShell for logged-in, minimal header for visitors)
- Implemented generateMetadata with Open Graph tags (title, description, cover image, music.album type) for SEO and social sharing
- Created 4 specialized components: ReleaseHero (cover art + metadata + Discogs link), YouTubeEmbed (privacy-enhanced iframe + search trigger), OwnersSection (grid with TrustStrip compact), ReviewsSection (paginated with load-more)
- Added getMoreReviews server action for cursor-based client-side pagination

## Task Commits

Each task was committed atomically:

1. **Task 1: Release layout + page with generateMetadata + hero component** - `60e84d5` (feat)
2. **Task 2: YouTube embed + owners section + reviews section components** - `1fa2ef0` (feat)

## Files Created/Modified
- `src/app/release/layout.tsx` - Public route layout with optional auth shell (copied perfil pattern)
- `src/app/release/[discogsId]/page.tsx` - Main release page with generateMetadata and data fetching
- `src/app/release/[discogsId]/_components/release-hero.tsx` - Cover art, metadata, rarity badge, Discogs link
- `src/app/release/[discogsId]/_components/youtube-embed.tsx` - Client component with youtube-nocookie.com iframe and search trigger
- `src/app/release/[discogsId]/_components/owners-section.tsx` - Server component with owner grid and TrustStrip compact trust ratings
- `src/app/release/[discogsId]/_components/reviews-section.tsx` - Client component with star ratings and load-more pagination
- `src/actions/release.ts` - Added getMoreReviews server action wrapping getReviewsForRelease

## Decisions Made
- Pre-fetch first 10 reviews server-side and pass as props to avoid client-side waterfall on initial load
- TrustStrip async Server Component renders natively inside OwnersSection (also async Server Component) without ts-expect-error workaround
- VER_TODOS link at bottom of owners section is a non-navigating span placeholder for future paginated owners page

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None.

## Known Stubs

- `VER_TODOS ({ownerCount})` link in owners-section.tsx (line 95) is a non-navigating span placeholder. Per plan spec: "For now this link does not navigate anywhere functional -- it is a placeholder for a future paginated owners page." This is intentional and documented.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- Release page route complete, ready for Plan 03 (entry point wiring from CollectionCard, RadarMatch, RecordSearchCard)
- All 4 sections render correctly: hero, YouTube, owners with trust, reviews with pagination
- Public access works without authentication; authenticated users get YouTube search and full app shell

## Self-Check: PASSED

- All 7 files verified (6 created, 1 modified)
- Both task commits found (60e84d5, 1fa2ef0)

---
*Phase: 12-release-pages*
*Completed: 2026-03-29*
