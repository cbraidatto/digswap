---
phase: 20-gem-economy
plan: 01
subsystem: gamification
tags: [gems, rarity, tailwind-css, css-animations, lucide, vitest, drizzle]

requires:
  - phase: 04-collection-management
    provides: rarity.ts, rarity-pill.tsx, releases.rarityScore column
provides:
  - GemTier type and 6-tier classification (getGemTier, getGemWeight, getGemInfo, computeGemScore)
  - GemBadge component (replaces RarityPill)
  - Gem distribution and score queries (getGemDistribution, getGemScoreForUser)
  - CSS custom properties and keyframe animations for all gem tiers
affects: [20-02, 20-03, 20-04, 20-05, gamification, profile, leaderboard, collection-display]

tech-stack:
  added: []
  patterns:
    - "SQL CASE expression for gem tier classification at query time"
    - "CSS custom properties for gem tier colors (theme-independent)"
    - "Tailwind @theme inline for gem color utilities (bg-gem-ruby/10, text-gem-sapphire)"
    - "Lucide icon mapping per gem tier (Hexagon, Gem, Diamond)"

key-files:
  created:
    - apps/web/src/lib/gems/constants.ts
    - apps/web/src/lib/gems/queries.ts
    - apps/web/src/components/ui/gem-badge.tsx
    - apps/web/tests/unit/gems/gem-tiers.test.ts
    - apps/web/tests/unit/gems/gem-badge.test.tsx
    - apps/web/tests/unit/gems/gem-distribution.test.ts
  modified:
    - apps/web/src/app/globals.css

key-decisions:
  - "Gem colors are theme-independent (declared once in :root, not per-theme) for brand consistency"
  - "GemBadge uses Tailwind theme color utilities (bg-gem-quartz/10) instead of raw hex for maintainability"
  - "Gem distribution computed at query time via SQL CASE, not stored as derived column (anti-pattern avoidance)"
  - "Diamond badge gets always-active prismatic + rainbow-edge animations (not hover-only)"

patterns-established:
  - "lib/gems/constants.ts as single source of truth for gem tier thresholds and weights"
  - "SQL CASE WHEN pattern for classifying rarity_score into gem tiers at query time"
  - "GemBadge component as drop-in RarityPill replacement with same inline-flex pill layout"

requirements-completed: [GEM-01, GEM-02, GEM-07]

duration: 3min
completed: 2026-04-06
---

# Phase 20 Plan 01: Gem Economy Foundation Summary

**6-tier gem classification system with GemBadge component, SQL distribution queries, 7 CSS keyframe animations, and 55 passing unit tests**

## Performance

- **Duration:** 3 min
- **Started:** 2026-04-06T19:08:45Z
- **Completed:** 2026-04-06T19:12:26Z
- **Tasks:** 1 (TDD: RED + GREEN)
- **Files modified:** 7

## Accomplishments
- GEM_TIERS constant with 6 tiers (Quartzo through Diamante) including Portuguese names, weights (1-100 exponential curve), and hex colors
- getGemTier() classifying want/have ratios at exact boundary values matching CONTEXT.md locked thresholds
- GemBadge component with per-tier Lucide icons (Hexagon/Gem/Diamond), Tailwind gem color classes, aria-label accessibility, and tier-specific hover/active animations
- SQL CASE-based getGemDistribution() and getGemScoreForUser() queries using Drizzle db.execute
- 7 CSS keyframe animations: gem-glow-purple, gem-shimmer-green, gem-pulse-warm, gem-glow-blue, gem-sparkle, gem-prismatic, gem-rainbow-edge
- Full reduced-motion support with static Diamante fallback
- 55 unit tests covering all tier boundaries, component rendering, icon mapping, and query logic

## Task Commits

Each task was committed atomically:

1. **Task 1 (RED): Failing tests** - `c373e6c` (test)
2. **Task 1 (GREEN): Implementation** - `f03f200` (feat)

**Plan metadata:** pending

_TDD task: RED commit for failing tests, GREEN commit for passing implementation._

## Files Created/Modified
- `apps/web/src/lib/gems/constants.ts` - GemTier type, GEM_TIERS array, getGemTier(), getGemWeight(), getGemInfo(), computeGemScore()
- `apps/web/src/lib/gems/queries.ts` - getGemDistribution() and getGemScoreForUser() with SQL CASE classification
- `apps/web/src/components/ui/gem-badge.tsx` - GemBadge component replacing RarityPill with gem icons and effects
- `apps/web/src/app/globals.css` - Gem CSS custom properties, Tailwind theme colors, 7 keyframe animations, reduced motion
- `apps/web/tests/unit/gems/gem-tiers.test.ts` - 31 tests for tier classification, weights, info, computeGemScore
- `apps/web/tests/unit/gems/gem-badge.test.tsx` - 17 tests for GemBadge component rendering and accessibility
- `apps/web/tests/unit/gems/gem-distribution.test.ts` - 7 tests for distribution and score query logic

## Decisions Made
- Gem colors declared theme-independently in `:root` only (not per-theme) since gem colors are brand assets
- Used Tailwind `@theme inline` registration for gem colors enabling utility classes like `bg-gem-ruby/10`
- Diamond badge uses always-active `animate-gem-prismatic` + `animate-gem-rainbow-edge` (not hover-triggered) as spec requires
- Gem distribution computed at SQL query time via CASE expression -- avoids storing derived tier column on releases table
- GemBadge `showScore` defaults to `false` (diverging from RarityPill's `showScore=true` default) matching UI-SPEC

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None.

## Known Stubs

None - all exports are fully implemented with real logic, no placeholder data.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- Gem constants and GemBadge component ready for 20-02 (RarityPill replacement across 9 consumer files)
- Gem queries ready for 20-03 (GemVault profile section) and 20-04 (ranking formula update)
- CSS animations ready for immediate visual effects when GemBadge is wired into pages

---
*Phase: 20-gem-economy*
*Completed: 2026-04-06*
