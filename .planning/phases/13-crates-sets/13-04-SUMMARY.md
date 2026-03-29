# Plan 13-04 Summary: Tests + Human Verification

**Phase:** 13-crates-sets
**Plan:** 04
**Status:** Complete
**Date:** 2026-03-29

## What Was Built

### Task 1: Automated Tests

**`tests/unit/crates/crates-actions.test.ts`** — 7 passing server action unit tests:
1. `createCrate` returns `{ success: true, data: { crateId } }`
2. `addToCrate` rejects when crate belongs to another user (IDOR guard)
3. `moveToWantlist` marks item found and inserts wantlist row
4. `moveToCollection` marks item found and inserts collection row
5. `markAsFound` updates status to found
6. `createSet` stores set_tracks with positions [1, 2, 3]
7. `updateSetTracks` replaces tracks and recomputes positions contiguously

**`tests/unit/crates/add-to-crate-popover.test.tsx`** — 3 passing component tests:
1. With 2 crates: renders 2 tappable crate rows
2. With empty crates: renders inline name input (placeholder "Crate name...")
3. Clicking a crate row calls `addToCrate` with the correct `crateId`

### Task 2: Human Verification

All 4 Phase 13 success criteria confirmed in the running app.

**Bugs found and fixed during verification:**
- Schema migration applied via Supabase MCP (`drizzle-kit push` failed due to CHECK constraint parsing bug in drizzle-kit)
- SetBuilderPanel: title text clipping fixed (`min-w-0` added to flex children)
- SetBuilderPanel: duplicate tracks and broken drag positions fixed (nested `setTrackOrder` inside `setSelectedItemIds` updater caused React StrictMode double-invoke — separated state updates)

## Files Modified

- `tests/unit/crates/crates-actions.test.ts` — created
- `tests/unit/crates/add-to-crate-popover.test.tsx` — created
- `tests/setup.ts` — updated (IS_REACT_ACT_ENVIRONMENT, @testing-library/user-event install)
- `src/app/(protected)/crates/[id]/_components/set-builder-panel.tsx` — bug fixes

## Deviations

- Tests placed in `tests/unit/crates/` per project convention (vitest config scans `tests/**`, not `src/tests/`)
- `@testing-library/user-event` installed (was missing from devDependencies)
- Schema applied via Supabase MCP SQL instead of `drizzle-kit push` due to drizzle-kit CHECK constraint parsing bug

## Verification Status

- `npx vitest run tests/unit/crates/` — 10/10 tests pass
- `npx tsc --noEmit` — zero errors
- Human checkpoint: APPROVED 2026-03-29
