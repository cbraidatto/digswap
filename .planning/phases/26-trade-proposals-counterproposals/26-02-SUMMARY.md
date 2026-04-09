---
phase: 26-trade-proposals-counterproposals
plan: 02
subsystem: ui
tags: [react, next.js, trade-proposals, collection-picker, quality-declaration, base-ui, dialog, server-components]

# Dependency graph
requires:
  - phase: 26-trade-proposals-counterproposals
    provides: createProposalAction, getTradeableCollectionItems, TradeableItem type
  - phase: 25-trade-schema-visibility
    provides: visibility column on collection_items, tradeProposals + tradeProposalItems tables
provides:
  - /trades/new/[userId] route with server page fetching both collections
  - ProposalBuilder client orchestrator with offer/want basket state, tier enforcement, submit flow
  - CollectionColumn with client-side search filter and selection state
  - ProposalItemCard with cover art, condition badge, audio quality, selected overlay
  - QualityDeclarationModal with condition grade picker and optional notes
affects: [26-03, 26-04, trade-detail-ui, desktop-trade]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Side-by-side collection picker: two CollectionColumns with shared basket state in parent"
    - "Quality declaration gate: modal intercept on item selection before basket addition"
    - "Tier enforcement in UI: maxSelectable prop propagated to disable cards at limit"
    - "BasketItemRow inline sub-component for compact proposal summary display"

key-files:
  created:
    - apps/web/src/app/(protected)/trades/new/[userId]/page.tsx
    - apps/web/src/app/(protected)/trades/new/[userId]/_components/ProposalBuilder.tsx
    - apps/web/src/app/(protected)/trades/new/[userId]/_components/CollectionColumn.tsx
    - apps/web/src/app/(protected)/trades/new/[userId]/_components/ProposalItemCard.tsx
    - apps/web/src/app/(protected)/trades/new/[userId]/_components/QualityDeclarationModal.tsx
  modified: []

key-decisions:
  - "Used existing project Dialog components (@base-ui/react) instead of raw @base-ui-components/react/dialog as plan specified"
  - "BasketItemRow as inline sub-component in ProposalBuilder rather than separate file for cohesion"
  - "Client-side search filter on CollectionColumn (no server re-fetch needed for item filtering)"
  - "Pre-fill quality grade from item.conditionGrade when opening QualityDeclarationModal"

patterns-established:
  - "Trade proposal UI pattern: server page fetches data, client ProposalBuilder orchestrates selection + submit"
  - "Quality gate pattern: pendingItem state triggers modal, onConfirm adds to basket"

requirements-completed: [TRD-03, TRD-04, TRD-05]

# Metrics
duration: 4min
completed: 2026-04-09
---

# Phase 26 Plan 02: Proposal Creation UI Summary

**Side-by-side proposal builder at /trades/new/[userId] with dual collection columns, quality declaration modal, free/premium tier enforcement, and submit-to-createProposalAction flow**

## Performance

- **Duration:** 4 min
- **Started:** 2026-04-09T17:30:29Z
- **Completed:** 2026-04-09T17:34:29Z
- **Tasks:** 2 (of 3 -- Task 3 is human-verify checkpoint)
- **Files modified:** 5

## Accomplishments
- Server page at /trades/new/[userId] fetching both users' tradeable collections, target profile, and quota status in parallel
- ProposalBuilder orchestrator with offer/want basket state, quality declaration gate, tier enforcement (free=1, premium=3), and createProposalAction submit flow
- CollectionColumn with client-side search by title/artist, selection count display, and disabled state at tier limit
- ProposalItemCard with cover art (or album icon fallback), condition badge, audio quality line, and selected overlay with check icon
- QualityDeclarationModal using project Dialog components with 7-grade picker, optional condition notes, and pre-fill from item data

## Task Commits

Each task was committed atomically:

1. **Task 1: Server page + CollectionColumn + ProposalItemCard** - `8468281` (feat)
2. **Task 2: ProposalBuilder + QualityDeclarationModal + submit flow** - `2cfd6f1` (feat)

**Plan metadata:** pending

## Files Created/Modified
- `apps/web/src/app/(protected)/trades/new/[userId]/page.tsx` - Server page fetching both collections + quota + target profile
- `apps/web/src/app/(protected)/trades/new/[userId]/_components/ProposalBuilder.tsx` - Client orchestrator with basket state, tier enforcement, and submit
- `apps/web/src/app/(protected)/trades/new/[userId]/_components/CollectionColumn.tsx` - One side of dual-column picker with search and selection state
- `apps/web/src/app/(protected)/trades/new/[userId]/_components/ProposalItemCard.tsx` - Record card with cover, condition, audio quality, and selection states
- `apps/web/src/app/(protected)/trades/new/[userId]/_components/QualityDeclarationModal.tsx` - Quality grade picker modal with condition notes

## Decisions Made
- Used existing project Dialog components (`@base-ui/react/dialog` wrapper from `@/components/ui/dialog`) instead of raw `@base-ui-components/react/dialog` as plan specified -- consistency with project patterns
- BasketItemRow as inline sub-component in ProposalBuilder rather than separate file -- keeps proposal display logic co-located with state
- Client-side search filter on CollectionColumn (no server re-fetch) -- items are already loaded in full for each user
- Pre-fill quality grade from `item.conditionGrade` when opening QualityDeclarationModal -- reduces user friction

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Used project Dialog components instead of raw Base UI import**
- **Found during:** Task 2
- **Issue:** Plan specified `import * as Dialog from "@base-ui-components/react/dialog"` but project uses `@base-ui/react/dialog` via `@/components/ui/dialog` wrapper
- **Fix:** Used project Dialog/DialogContent/DialogHeader/DialogTitle/DialogDescription/DialogFooter components
- **Files modified:** QualityDeclarationModal.tsx
- **Verification:** TypeScript compiles clean, consistent with all other project dialogs
- **Committed in:** 2cfd6f1

---

**Total deviations:** 1 auto-fixed (1 bug)
**Impact on plan:** Minor import path correction. No scope creep.

## Issues Encountered
None.

## User Setup Required
None - no external service configuration required.

## Known Stubs
None - all data paths are fully wired to 26-01 server actions and query layer.

## Next Phase Readiness
- Proposal creation UI complete and ready for human verification (Task 3 checkpoint)
- Route is live at /trades/new/[userId] and calls createProposalAction on submit
- Types from 26-01 (TradeableItem, createProposalAction) are fully integrated
- Ready for 26-03 (proposal detail/history UI) and 26-04 (counterproposal UI)

## Self-Check: PASSED

All 5 files verified present. All 2 commits verified in git log.

---
*Phase: 26-trade-proposals-counterproposals*
*Completed: 2026-04-09*
