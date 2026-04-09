---
phase: 25-trade-schema-visibility
plan: 03
subsystem: ui
tags: [react, tailwind, collection, visibility, trading, profile, server-actions]

# Dependency graph
requires:
  - phase: 25-trade-schema-visibility
    plan: 01
    provides: visibility column on collection_items, audio quality metadata columns
  - phase: 25-trade-schema-visibility
    plan: 02
    provides: setVisibility server action, updated CollectionItem interface
  - phase: 04-collection-management
    provides: collection-card, trading-tab, perfil page components
provides:
  - VisibilitySelector component for 3-state item visibility
  - Collection cards with visibility badges (TRADING/PRIVATE)
  - Context menu with 3-state visibility options
  - Trading tab filtering by visibility=tradeable
  - Public profile excludePrivate defense-in-depth
affects: [trade-ui, collection-display, public-profiles]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Cycle-on-click UI pattern: VisibilitySelector cycles through states without dropdown"
    - "Backward-compatible context menu: onSetVisibility alongside legacy onToggleTrade"
    - "Defense-in-depth query option: excludePrivate at query level for Drizzle client"

key-files:
  created:
    - apps/web/src/components/ui/visibility-selector.tsx
  modified:
    - apps/web/src/app/(protected)/(profile)/perfil/_components/collection-card.tsx
    - apps/web/src/app/(protected)/(profile)/perfil/_components/collection-card-expanded.tsx
    - apps/web/src/app/(protected)/(profile)/perfil/_components/trading-tab.tsx
    - apps/web/src/app/(protected)/(profile)/perfil/page.tsx
    - apps/web/src/app/perfil/[username]/page.tsx
    - apps/web/src/components/ui/record-context-menu.tsx
    - apps/web/src/lib/collection/queries.ts
    - apps/web/src/lib/db/schema/collections.ts
    - apps/web/src/actions/collection.ts
    - apps/web/tests/unit/components/collection/collection-grid.test.tsx

key-decisions:
  - "VisibilitySelector uses click-to-cycle (not dropdown) for compact card layout"
  - "Context menu supports both onSetVisibility and legacy onToggleTrade for backward compat"
  - "excludePrivate query option is defense-in-depth alongside RLS for Drizzle direct queries"

patterns-established:
  - "Click-to-cycle selector: compact state cycling button for inline use in cards"
  - "Dual-API migration: new prop alongside deprecated prop for gradual consumer migration"

requirements-completed: [TRD-01]

# Metrics
duration: 6min
completed: 2026-04-09
---

# Phase 25 Plan 03: Collection Visibility UI Summary

**3-state visibility UI (tradeable/not_trading/private) on collection cards with VisibilitySelector component, updated trading tab, and public profile privacy filtering**

## Performance

- **Duration:** 6 min
- **Started:** 2026-04-09T16:22:45Z
- **Completed:** 2026-04-09T16:28:35Z
- **Tasks:** 2
- **Files modified:** 11

## Accomplishments
- Created VisibilitySelector component with click-to-cycle pattern (not_trading -> tradeable -> private)
- Updated collection cards (standard and expanded) to show TRADING/PRIVATE visibility badges
- Updated RecordContextMenu with 3-state visibility options while preserving legacy onToggleTrade
- Trading tab now filters by visibility=tradeable with updated empty state messaging
- Public profile pages pass excludePrivate option for defense-in-depth privacy

## Task Commits

Each task was committed atomically:

1. **Task 1: Create VisibilitySelector component and update collection cards** - `f377a83` (feat)
2. **Task 2: Update trading tab and profile pages for visibility-based filtering** - `282c552` (feat)

**Plan metadata:** pending

## Files Created/Modified
- `apps/web/src/components/ui/visibility-selector.tsx` - New VisibilitySelector component with cycle-on-click behavior
- `apps/web/src/app/(protected)/(profile)/perfil/_components/collection-card.tsx` - Visibility badges, VisibilitySelector for owners, removed toggleOpenForTrade
- `apps/web/src/app/(protected)/(profile)/perfil/_components/collection-card-expanded.tsx` - Same visibility updates as collection-card
- `apps/web/src/components/ui/record-context-menu.tsx` - 3-state visibility menu items with backward compat
- `apps/web/src/app/(protected)/(profile)/perfil/_components/trading-tab.tsx` - Renamed to tradeableItems, updated labels
- `apps/web/src/app/(protected)/(profile)/perfil/page.tsx` - Filter by visibility=tradeable
- `apps/web/src/app/perfil/[username]/page.tsx` - Added excludePrivate option
- `apps/web/src/lib/collection/queries.ts` - Added visibility/audioFormat/bitrate/sampleRate fields, excludePrivate option
- `apps/web/src/lib/db/schema/collections.ts` - Added visibility, audioFormat, bitrate, sampleRate columns + public RLS
- `apps/web/src/actions/collection.ts` - Added setVisibility server action
- `apps/web/tests/unit/components/collection/collection-grid.test.tsx` - Updated test fixtures for new fields

## Decisions Made
- VisibilitySelector uses compact click-to-cycle pattern instead of dropdown to fit card layout
- RecordContextMenu supports both new onSetVisibility and legacy onToggleTrade props for backward compat
- excludePrivate query option added to getCollectionPage for defense-in-depth (Drizzle bypasses RLS)
- Schema, query, and action changes bundled with UI (Rule 3 blocking dependency from 25-01/25-02)

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Applied schema + query + action changes from dependent plans 25-01/25-02**
- **Found during:** Task 1 (before creating UI components)
- **Issue:** Plans 25-01 and 25-02 were running in parallel worktrees; this worktree lacked the schema visibility column, updated queries, and setVisibility action
- **Fix:** Applied schema changes (visibility column, audioFormat, bitrate, sampleRate, public RLS policy), updated CollectionItem interface and getCollectionPage query, added setVisibility server action
- **Files modified:** collections.ts (schema), queries.ts, collection.ts (actions)
- **Verification:** TypeScript compilation passes for all modified files
- **Committed in:** f377a83 (Task 1 commit)

**2. [Rule 1 - Bug] Updated collection-grid test fixture for new CollectionItem fields**
- **Found during:** Task 1 verification
- **Issue:** Test fixture missing visibility, audioFormat, bitrate, sampleRate fields causing TS2322
- **Fix:** Added missing fields to makeItem helper
- **Files modified:** collection-grid.test.tsx
- **Verification:** TypeScript compilation passes
- **Committed in:** f377a83 (Task 1 commit)

---

**Total deviations:** 2 auto-fixed (1 blocking, 1 bug)
**Impact on plan:** Both auto-fixes necessary for the UI plan to compile. Schema/action work duplicates 25-01/25-02 but will merge cleanly.

## Issues Encountered

None beyond the dependency resolution documented as deviations.

## User Setup Required

None - no external service configuration required.

## Known Stubs

None - all UI components are wired to real server actions and data sources.

## Next Phase Readiness
- Visibility UI complete: owners can set tradeable/not_trading/private on any collection item
- Trading tab shows only tradeable items
- Public profiles exclude private items
- Ready for 25-04 (trade proposal UI) to build on this visibility foundation

## Self-Check: PASSED

All 10 created/modified files verified present. Both task commits (f377a83, 282c552) verified in git log.

---
*Phase: 25-trade-schema-visibility*
*Completed: 2026-04-09*
