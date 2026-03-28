---
phase: 10-positioning-radar-workspace
plan: 04
subsystem: ui, database, api
tags: [og-image, public-pages, trust-strip, holy-grails, webrtc-identity, next-og, jsonb]

# Dependency graph
requires:
  - phase: 10-positioning-radar-workspace/10-02
    provides: TrustStrip component and ShareSurface component
provides:
  - holy_grail_ids jsonb column on profiles table
  - Public Bounty Link page at /u/[username]/bounty
  - OG Rarity Score Card image route at /api/og/rarity/[username]
  - TrustStrip integrated into all profile headers (replaces trade stat line)
  - HolyGrailSelector client component for own profile
  - RarityCardModal client component for own profile
  - updateHolyGrails server action
affects: [10-positioning-radar-workspace, viral-acquisition, public-profiles]

# Tech tracking
tech-stack:
  added: [next/og ImageResponse]
  patterns: [public-page-outside-protected-group, og-image-generation, jsonb-array-column]

key-files:
  created:
    - src/app/u/[username]/bounty/page.tsx
    - src/app/api/og/rarity/[username]/route.tsx
    - src/app/(protected)/(profile)/perfil/_components/holy-grail-selector.tsx
    - src/app/(protected)/(profile)/perfil/_components/rarity-card-modal.tsx
  modified:
    - src/lib/db/schema/users.ts
    - src/app/(protected)/(profile)/perfil/[username]/_components/profile-header.tsx
    - src/app/perfil/[username]/_components/profile-header.tsx
    - src/app/perfil/[username]/page.tsx
    - src/app/(protected)/(profile)/perfil/page.tsx
    - src/actions/profile.ts

key-decisions:
  - "Node.js runtime for OG image route instead of edge -- postgres driver not edge-compatible"
  - "TrustStrip replaces trade stat line in both protected and public profile headers"
  - "Updated public profile header to also use TrustStrip (consistency deviation)"

patterns-established:
  - "OG image generation: use next/og ImageResponse with Node.js runtime for DB-backed routes"
  - "Public pages outside (protected) group: /u/[username] pattern for unauthenticated access"
  - "Holy Grail IDs stored as jsonb array on profiles (max 3 wantlist item IDs)"

requirements-completed: [IDENTITY-01, IDENTITY-02, IDENTITY-03, IDENTITY-04]

# Metrics
duration: 7min
completed: 2026-03-28
---

# Phase 10 Plan 04: Public Identity + Viral Acquisition Surfaces Summary

**TrustStrip on all profiles, public Bounty Link page with Holy Grails, OG Rarity Score Card image route, and own-profile sharing controls**

## Performance

- **Duration:** 7 min
- **Started:** 2026-03-28T12:31:50Z
- **Completed:** 2026-03-28T12:39:39Z
- **Tasks:** 3
- **Files modified:** 10

## Accomplishments
- TrustStrip (4 metrics: RESPONSE, COMPLETION, AVG_QUALITY, TRADES) replaces single-line trade stat on all profile headers
- Public Bounty Link page at /u/[username]/bounty loads without authentication, shows up to 3 Holy Grail records with dual CTAs
- OG Rarity Score Card at /api/og/rarity/[username] generates 1200x630 PNG with Ghost Protocol colors, showing obscurity percentile, collection count, ultra-rare count, and avg rarity
- Own profile now has HolyGrailSelector (max 3 wantlist items), SHARE_BOUNTY_LINK button, and GENERATE_RARITY_CARD modal

## Task Commits

Each task was committed atomically:

1. **Task 1: Schema migration + TrustStrip in profile headers** - `0d9bdb6` (feat)
2. **Task 2: Bounty Link public page** - `555ae6a` (feat)
3. **Task 3: Rarity Score Card OG image route** - `ecd694d` (feat)

## Files Created/Modified
- `src/lib/db/schema/users.ts` - Added holyGrailIds jsonb column to profiles table
- `src/app/(protected)/(profile)/perfil/[username]/_components/profile-header.tsx` - Replaced trade stat with TrustStrip compact variant
- `src/app/perfil/[username]/_components/profile-header.tsx` - Replaced trade stat with TrustStrip compact variant (public profile)
- `src/app/perfil/[username]/page.tsx` - Removed tradeReputation prop passing (TrustStrip handles it internally)
- `src/app/(protected)/(profile)/perfil/page.tsx` - Added TrustStrip full variant, HolyGrailSelector, ShareSurface, RarityCardModal
- `src/actions/profile.ts` - Added updateHolyGrails server action (validates max 3 items)
- `src/app/(protected)/(profile)/perfil/_components/holy-grail-selector.tsx` - Client component for selecting up to 3 Holy Grails from wantlist
- `src/app/(protected)/(profile)/perfil/_components/rarity-card-modal.tsx` - Client component dialog showing OG image preview with share controls
- `src/app/u/[username]/bounty/page.tsx` - Public Bounty Link page with Holy Grail cards and dual CTAs
- `src/app/api/og/rarity/[username]/route.tsx` - OG image generation with collection stats and JetBrains Mono font

## Decisions Made
- Used Node.js runtime for OG image route instead of edge because postgres driver with PgBouncer connection pooler is not edge-compatible. Only affects latency, not correctness
- Also updated the public profile header (src/app/perfil/[username]) to use TrustStrip for consistency -- plan only mentioned the protected profile header but both had the same trade stat line
- Removed tradeReputation prop from both profile header interfaces since TrustStrip fetches its own data server-side

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Updated public profile header to TrustStrip**
- **Found during:** Task 1
- **Issue:** Plan referenced only the protected profile header, but the public profile header at src/app/perfil/[username] had an identical trade stat line that would be inconsistent
- **Fix:** Applied same TrustStrip replacement to public profile header and removed tradeReputation prop from the public profile page
- **Files modified:** src/app/perfil/[username]/_components/profile-header.tsx, src/app/perfil/[username]/page.tsx
- **Verification:** TypeScript clean, both profile headers now use TrustStrip
- **Committed in:** 0d9bdb6 (Task 1 commit)

**2. [Rule 1 - Bug] Removed unused @ts-expect-error directives**
- **Found during:** Task 1 verification
- **Issue:** Added @ts-expect-error for async server component rendering but TypeScript accepted it without error, making the directive unused (TS2578)
- **Fix:** Removed all three @ts-expect-error comments
- **Files modified:** Both profile-header.tsx files and perfil/page.tsx
- **Verification:** TypeScript clean -- no TS2578 errors
- **Committed in:** 0d9bdb6 (Task 1 commit)

---

**Total deviations:** 2 auto-fixed (2 bug fixes)
**Impact on plan:** Both fixes necessary for correctness and consistency. No scope creep.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required. @vercel/og ImageResponse is built into Next.js 15.

## Known Stubs
None - all data sources are wired to real database queries.

## Next Phase Readiness
- Public identity surfaces are live: Bounty Link, Rarity Card, TrustStrip
- Holy Grail selection persisted to profiles.holy_grail_ids
- drizzle-kit push needed to apply holy_grail_ids column to Supabase (schema change only in code)
- Ready for remaining Phase 10 plans

## Self-Check: PASSED

All 10 files verified present. All 3 commit hashes verified in git log.

---
*Phase: 10-positioning-radar-workspace*
*Completed: 2026-03-28*
