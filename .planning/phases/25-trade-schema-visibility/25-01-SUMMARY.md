---
phase: 25-trade-schema-visibility
plan: 01
subsystem: database
tags: [drizzle, postgres, rls, schema, trade-proposals, visibility, collection-items]

# Dependency graph
requires:
  - phase: 09-p2p-audio-trading
    provides: trade_requests table, tradeMessages, tradeReviews
  - phase: 04-collection-management
    provides: collection_items table with open_for_trade column
provides:
  - visibility column on collection_items (tradeable/not_trading/private)
  - audio quality metadata columns (audio_format, bitrate, sample_rate)
  - cross-user SELECT RLS for non-private collection items
  - trade_proposals table for counterproposal chains
  - trade_proposal_items junction table for multi-item proposals
affects: [25-02, 25-03, trade-actions, collection-ui, trade-ui]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Dual RLS SELECT pattern: owner-sees-all + public-sees-non-private"
    - "Counterproposal chain via sequence_number on trade_proposals"
    - "Junction table with side column (offer/want) for multi-item trades"

key-files:
  created:
    - supabase/migrations/20260409_visibility_and_trade_proposals.sql
  modified:
    - apps/web/src/lib/db/schema/collections.ts
    - apps/web/src/lib/db/schema/trades.ts

key-decisions:
  - "Visibility column replaces open_for_trade with three states: tradeable, not_trading, private"
  - "open_for_trade column kept for backward compat during migration (deprecated annotation)"
  - "Dual SELECT RLS: owner sees all own items, other users see non-private items"
  - "Partial index on visibility WHERE tradeable for fast tradeable-item lookups"

patterns-established:
  - "Dual RLS SELECT: owner policy + public policy on same table for visibility-gated access"
  - "Counterproposal chain: trade_proposals with sequence_number for proposal history"

requirements-completed: [TRD-01, TRD-02, TRD-04]

# Metrics
duration: 3min
completed: 2026-04-09
---

# Phase 25 Plan 01: Trade Schema + Visibility Summary

**Drizzle schema and SQL migration for collection visibility (tradeable/not_trading/private), audio quality metadata, and trade proposal counterproposal chain tables**

## Performance

- **Duration:** 3 min
- **Started:** 2026-04-09T16:15:48Z
- **Completed:** 2026-04-09T16:18:59Z
- **Tasks:** 2
- **Files modified:** 3

## Accomplishments
- Added visibility column to collection_items with three-state enum replacing binary open_for_trade
- Added audio quality metadata columns (audio_format, bitrate, sample_rate) for TRD-02
- Created trade_proposals table supporting counterproposal chains with sequence_number
- Created trade_proposal_items junction table with offer/want sides for multi-item proposals
- Updated RLS to allow cross-user SELECT on non-private collection items
- Created idempotent SQL migration with data migration from open_for_trade to visibility

## Task Commits

Each task was committed atomically:

1. **Task 1: Update Drizzle schema** - `30ea1f2` (feat)
2. **Task 2: Create SQL migration** - `37c7257` (chore)

**Plan metadata:** pending

## Files Created/Modified
- `apps/web/src/lib/db/schema/collections.ts` - Added visibility, audio_format, bitrate, sample_rate columns + public SELECT RLS policy + partial index
- `apps/web/src/lib/db/schema/trades.ts` - Added tradeProposals and tradeProposalItems tables with participant-scoped RLS
- `supabase/migrations/20260409_visibility_and_trade_proposals.sql` - Complete SQL migration with data migration, RLS updates, new tables

## Decisions Made
- Visibility column uses varchar with three values (tradeable/not_trading/private) rather than an enum type for simpler migration and flexibility
- open_for_trade column kept in schema with deprecation comment for backward compat during migration period
- Dual SELECT RLS pattern: owner sees all items (including private), other authenticated users see non-private items only
- Partial index on visibility column filtered to 'tradeable' for optimized tradeable-item lookups

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- Schema foundation complete for plans 25-02 (server actions) and 25-03 (UI components)
- Drizzle types available for import: collectionItems with visibility, tradeProposals, tradeProposalItems
- SQL migration ready to apply to Supabase via `supabase db push` or migration runner

---
*Phase: 25-trade-schema-visibility*
*Completed: 2026-04-09*
