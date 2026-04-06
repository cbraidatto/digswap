---
phase: 20-gem-economy
plan: 03
subsystem: gamification
tags: [gem-economy, ui-sweep, rarity-replacement, gemBadge, leaderboard, notifications]

# Dependency graph
requires:
  - phase: 20-gem-economy plan 01
    provides: GemBadge component, getGemTier function, gem CSS classes
  - phase: 20-gem-economy plan 02
    provides: UserRanking.gemScore interface, recalibrated RANK_TITLES
provides:
  - All 12 consumer files migrated from RarityPill to GemBadge
  - RankCard with gemScore prop and "Gem Score" label
  - LeaderboardRow with "gems" suffix format
  - NotificationRow with gem_tier_change case
  - Profile page data flow passing gemScore from getUserRanking
affects: [20-04, 20-05, profile, leaderboard, notifications, feed]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "GemBadge as universal record-level gem display (replaces RarityPill everywhere)"
    - "getGemStripColor helper for feed card accent strips mapped to gem tiers"

key-files:
  created: []
  modified:
    - apps/web/src/app/(protected)/(profile)/perfil/_components/collection-card.tsx
    - apps/web/src/app/(protected)/(feed)/feed/_components/feed-card.tsx
    - apps/web/src/app/(protected)/(feed)/feed/_components/group-feed-card.tsx
    - apps/web/src/app/(protected)/(explore)/explorar/_components/record-search-card.tsx
    - apps/web/src/app/(protected)/(explore)/explorar/_components/browse-grid.tsx
    - apps/web/src/app/(protected)/(explore)/explorar/_components/trending-section.tsx
    - apps/web/src/app/(protected)/(explore)/explorar/_components/suggested-section.tsx
    - apps/web/src/app/(protected)/(profile)/perfil/_components/wantlist-match-section.tsx
    - apps/web/src/app/(protected)/(profile)/perfil/_components/wantlist-card.tsx
    - apps/web/src/app/release/[discogsId]/_components/release-hero.tsx
    - apps/web/src/app/release/[discogsId]/_components/similar-section.tsx
    - apps/web/src/app/(protected)/(profile)/perfil/[username]/compare/page.tsx
    - apps/web/src/app/(protected)/(profile)/perfil/_components/rank-card.tsx
    - apps/web/src/app/(protected)/(explore)/explorar/_components/leaderboard-row.tsx
    - apps/web/src/app/(protected)/(profile)/perfil/_components/about-tab.tsx
    - apps/web/src/app/(protected)/(profile)/perfil/page.tsx
    - apps/web/src/components/shell/notification-row.tsx

key-decisions:
  - "Feed card accent strip mapped to gem tier colors instead of old 3-tier rarity colors"
  - "release-hero.tsx uses GemBadge with showScore=true for detailed release view"
  - "compare page uses GemBadge with showScore=true instead of custom RARITY text display"
  - "Removed unused helper functions (getRarityColors, getRarityStyle, getRarityLabel) during migration"

patterns-established:
  - "GemBadge default showScore=false for compact views (cards, pills), showScore=true for detail views (release hero, comparison)"
  - "Gem strip color helper for feed accent strips: getGemStripColor mapping tier to bg-gem-* classes"

requirements-completed: [GEM-01, GEM-06]

# Metrics
duration: 7min
completed: 2026-04-06
---

# Phase 20 Plan 03: Gem Economy Consumer UI Sweep Summary

**Complete RarityPill-to-GemBadge migration across 17 files covering collection, feed, explore, release, compare, profile, leaderboard, and notifications**

## Performance

- **Duration:** 7 min
- **Started:** 2026-04-06T19:15:56Z
- **Completed:** 2026-04-06T19:23:01Z
- **Tasks:** 2
- **Files modified:** 17

## Accomplishments
- Migrated all 12 consumer files from RarityPill/getRarityTier to GemBadge/getGemTier with zero new TypeScript errors
- Updated RankCard to display "Gem Score" label with localized number format, profile data flow passing gemScore throughout component tree
- Updated leaderboard row from "pts" to "gems" suffix, added gem_tier_change notification type

## Task Commits

Each task was committed atomically:

1. **Task 1: Replace RarityPill with GemBadge across all 12 consumer files** - `8157370` (feat)
2. **Task 2: Update RankCard, LeaderboardRow, NotificationRow, AboutTab, and profile page data flow** - `b017dc3` (feat)

**Plan metadata:** pending

## Files Created/Modified
- `collection-card.tsx` - Replaced RarityPill import/usage with GemBadge, getRarityTier with getGemTier
- `feed-card.tsx` - Replaced getRarityTier with getGemTier, custom rarity styling with gem strip colors, rarity pill with GemBadge
- `group-feed-card.tsx` - Replaced RarityPill with GemBadge
- `record-search-card.tsx` - Replaced getRarityTier + custom badge with GemBadge
- `browse-grid.tsx` - Replaced RarityPill with GemBadge
- `trending-section.tsx` - Replaced RarityPill with GemBadge
- `suggested-section.tsx` - Replaced RarityPill with GemBadge
- `wantlist-match-section.tsx` - Replaced RarityPill with GemBadge, removed unused getRarityLabel
- `wantlist-card.tsx` - Replaced RarityPill with GemBadge
- `release-hero.tsx` - Replaced getRarityTier/getRarityBadgeVariant/Badge with GemBadge (showScore=true)
- `similar-section.tsx` - Replaced RarityPill with GemBadge
- `compare/page.tsx` - Replaced getRarityTier + custom rarity display with GemBadge (showScore=true)
- `rank-card.tsx` - Prop renamed rarityScore to gemScore, label changed to "Gem Score", format changed to toLocaleString()
- `leaderboard-row.tsx` - Score format changed from "1.0pts" to "1,000 gems"
- `about-tab.tsx` - Stats interface updated from rarityScore to gemScore, all downstream prop passes updated
- `perfil/page.tsx` - Profile page passes ranking?.gemScore to AboutTab stats object
- `notification-row.tsx` - Added gem_tier_change case with diamond icon

## Decisions Made
- Feed card accent strip uses gem-tier-specific colors (bg-gem-sapphire, bg-gem-ruby, etc.) instead of the old 3-tier system (bg-tertiary, bg-secondary, bg-primary)
- release-hero.tsx and compare/page.tsx use showScore=true for detailed views where score visibility adds value
- Removed unused helper functions during migration (getRarityColors, getRarityStyle, getRarityLabel) to avoid dead code
- Action icon in feed card uses static text-primary instead of tier-dependent color (gem badge itself conveys tier)

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Re-added Badge import in release-hero.tsx**
- **Found during:** Task 1
- **Issue:** Removing getRarityTier/getRarityBadgeVariant imports also removed Badge import, but Badge is still used for genre chips lower in the component
- **Fix:** Re-added `import { Badge } from "@/components/ui/badge"` alongside the new GemBadge import
- **Files modified:** apps/web/src/app/release/[discogsId]/_components/release-hero.tsx
- **Verification:** TypeScript compilation passes
- **Committed in:** 8157370 (Task 1 commit)

---

**Total deviations:** 1 auto-fixed (1 Rule 1 bug)
**Impact on plan:** Trivial fix necessary for correctness. No scope creep.

## Known Stubs

None - all gem badge integrations are fully wired with real data from existing rarityScore columns.

## Issues Encountered
None.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- All consumer files now display GemBadge -- Plans 04 and 05 can build on top (GemVault section, challenges)
- RarityPill component file (rarity-pill.tsx) still exists but is no longer imported anywhere in app/ -- can be deprecated
- Old rarity.ts (getRarityTier, getRarityBadgeVariant) still exists for backward compat but no longer used in app/ files

## Self-Check: PASSED

- All 17 modified files exist on disk
- Commit 8157370 (Task 1) verified in git log
- Commit b017dc3 (Task 2) verified in git log
- Zero RarityPill imports remain in app/ directory
- Zero getRarityTier calls remain in app/ directory
- TypeScript compilation produces zero new errors

---
*Phase: 20-gem-economy*
*Completed: 2026-04-06*
