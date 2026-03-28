---
phase: 10-positioning-radar-workspace
plan: 01
subsystem: ui
tags: [landing-page, public-profile, onboarding, positioning, adr-001]

# Dependency graph
requires:
  - phase: 09-p2p-audio-trading
    provides: P2P trade system, trade reputation, RequestAudioButton
  - phase: 05-social-layer
    provides: Follow system, public profile page, activity feed
  - phase: 06-discovery-notifications
    provides: Wantlist matching, owners-list, record search
provides:
  - ADR-001 repositioned landing page (no "social network" or "P2P audio" copy)
  - Public profile route accessible without authentication
  - Owners-list with VIEW_PROFILE replacing REQUEST_TRADE
  - Non-skippable Discogs onboarding step
  - Zero picsum.photos placeholder images in codebase
affects: [10-positioning-radar-workspace, 11-security-hardening]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Optional auth layout pattern: src/app/perfil/layout.tsx with conditional AppShell vs PublicShell"
    - "Route ungating: move from (protected) group to public route for auth-optional pages"

key-files:
  created:
    - src/app/perfil/layout.tsx
    - src/app/perfil/[username]/page.tsx
    - src/app/perfil/[username]/_components/profile-header.tsx
    - src/app/perfil/[username]/_components/follow-button.tsx
  modified:
    - src/app/page.tsx
    - src/app/layout.tsx
    - src/app/(protected)/(explore)/explorar/_components/owners-list.tsx
    - src/app/(protected)/(explore)/explorar/_components/record-search-card.tsx
    - src/app/(protected)/(explore)/explorar/_components/record-search.tsx
    - src/app/(protected)/(explore)/explorar/_components/records-tab.tsx
    - src/app/(protected)/(explore)/explorar/page.tsx
    - src/app/(protected)/onboarding/page.tsx
    - src/components/onboarding/discogs-connect.tsx
    - src/app/(protected)/(feed)/feed/_components/feed-showcase.tsx

key-decisions:
  - "Public profile route moved to src/app/perfil/ outside (protected) group to bypass layout-level auth redirect"
  - "ProfileHeader gets isAuthenticated prop to conditionally render Follow/Compare buttons for visitors"
  - "Removed p2pEnabled/currentUserId prop chain from OwnersList through RecordSearchCard/RecordSearch/RecordsTab/ExplorarPage"
  - "Feed showcase uses Material Symbols icons as Ghost Protocol placeholders instead of picsum.photos external images"

patterns-established:
  - "Optional auth layout: fetch user without redirect, render AppShell for authed or PublicShell for visitors"
  - "Visitor CTA pattern: [VISITOR] // message with START_DIGGING link for unauthenticated profile visitors"

requirements-completed: [ADR-001, IDENTITY-01, WORKSPACE-01]

# Metrics
duration: 9min
completed: 2026-03-28
---

# Phase 10 Plan 01: P0 Unblocking Summary

**ADR-001 landing page rewrite, public profile ungating, Discogs onboarding lock, and picsum placeholder removal**

## Performance

- **Duration:** 9 min
- **Started:** 2026-03-28T12:05:00Z
- **Completed:** 2026-03-28T12:14:32Z
- **Tasks:** 3
- **Files modified:** 14

## Accomplishments
- Landing page rewritten with ADR-001 positioning: Holy Grails headline, three monospace status lines, START_DIGGING/SIGN_IN CTAs, no "social network" or "P2P audio" copy
- Public profile route moved out of (protected) group with optional auth layout, allowing unauthenticated visitors to view profiles and see a signup CTA
- REQUEST_TRADE removed from owners-list across the entire explorar search chain, replaced with VIEW_PROFILE links
- Discogs onboarding step made non-skippable with [REQUIRED] message explaining Radar dependency
- All picsum.photos references replaced with Ghost Protocol icon placeholders; Portuguese labels translated to English in feed showcase

## Task Commits

Each task was committed atomically:

1. **Task 1: Rewrite landing page + update layout metadata** - `56c504a` (feat)
2. **Task 2: Remove REQUEST_TRADE from owners-list + ungate public profile** - `e3e0611` (feat)
3. **Task 3: Lock Discogs onboarding step + global copy sweep** - `3cae421` (feat)

## Files Created/Modified
- `src/app/page.tsx` - Rewritten landing page with ADR-001 positioning
- `src/app/layout.tsx` - Updated title and meta description
- `src/app/perfil/layout.tsx` - New optional-auth layout with AppShell/PublicShell conditional
- `src/app/perfil/[username]/page.tsx` - Public profile page with optional auth (moved from protected)
- `src/app/perfil/[username]/_components/profile-header.tsx` - Profile header with isAuthenticated guard
- `src/app/perfil/[username]/_components/follow-button.tsx` - Follow button (copied for public route)
- `src/app/(protected)/(explore)/explorar/_components/owners-list.tsx` - VIEW_PROFILE replacing REQUEST_TRADE
- `src/app/(protected)/(explore)/explorar/_components/record-search-card.tsx` - Removed unused p2p props
- `src/app/(protected)/(explore)/explorar/_components/record-search.tsx` - Removed unused p2p props
- `src/app/(protected)/(explore)/explorar/_components/records-tab.tsx` - Removed unused p2p props
- `src/app/(protected)/(explore)/explorar/page.tsx` - Removed p2pEnabled state and import
- `src/app/(protected)/onboarding/page.tsx` - Removed onSkip callback from DiscogsConnect
- `src/components/onboarding/discogs-connect.tsx` - Removed skip button, added [REQUIRED] message
- `src/app/(protected)/(feed)/feed/_components/feed-showcase.tsx` - Replaced picsum images with icon placeholders, English labels

## Decisions Made
- Moved public profile to `src/app/perfil/` outside the `(protected)` route group rather than modifying middleware, because the `(protected)/layout.tsx` has a hard redirect on `!user` that runs before page-level code
- Copied `ProfileHeader` and `FollowButton` components to the public route rather than importing cross-group, to allow adding `isAuthenticated` prop without affecting the existing protected profile header
- Removed the entire `p2pEnabled`/`currentUserId` prop chain from `OwnersList` up through `ExplorarPage` since those props were only used for REQUEST_TRADE which is now removed
- Left `REQUEST_TRADE` in `notification-row.tsx` untouched since it's a contextual action from wantlist match notifications (not a search result), and is not listed in the plan's must_haves

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Removed unused p2pEnabled/currentUserId props from parent components**
- **Found during:** Task 2 (owners-list refactor)
- **Issue:** After removing REQUEST_TRADE from OwnersList, the p2pEnabled and currentUserId props became unused in the parent chain (RecordSearchCard, RecordSearch, RecordsTab, ExplorarPage)
- **Fix:** Removed unused props and interfaces from all parent components up to ExplorarPage
- **Files modified:** record-search-card.tsx, record-search.tsx, records-tab.tsx, explorar/page.tsx
- **Verification:** TypeScript compiles clean with no unused variable warnings
- **Committed in:** e3e0611 (Task 2 commit)

---

**Total deviations:** 1 auto-fixed (1 blocking)
**Impact on plan:** Necessary cleanup to avoid dead code after REQUEST_TRADE removal. No scope creep.

## Issues Encountered
- Pre-existing TypeScript errors exist in test files (genre-browse.test.ts, profile-ranking.test.ts, etc.) but are unrelated to this plan's changes. All files modified by this plan compile clean.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Public profile route is accessible without login, unblocking Bounty Link and Radar Receipt acquisition mechanics
- Landing page positioning is ADR-001 compliant, ready for Sprint 0.5 leads schema and primitives
- Discogs onboarding gate enforced, ensuring all new users have collection data for Radar functionality
- Feed showcase ready for real data integration in future plans

## Self-Check: PASSED

- All 9 created/modified files verified on disk
- All 3 task commits verified in git log (56c504a, e3e0611, 3cae421)

---
*Phase: 10-positioning-radar-workspace*
*Completed: 2026-03-28*
