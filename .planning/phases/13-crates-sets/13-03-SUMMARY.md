---
phase: 13-crates-sets
plan: "03"
subsystem: crates-entry-points
tags: [components, popover, base-ui, client-components, entry-points, crates]
dependency_graph:
  requires:
    - 13-01 (crates data layer — addToCrate, createCrate, getUserCratesAction)
  provides:
    - AddToCratePopover: @base-ui/react Popover with crate list + inline create form
    - AddToCrateButton: trigger button wrapping AddToCratePopover
    - [ADD_TO_CRATE] entry points on CollectionCard, RadarMatch, RecordSearchCard, release page
  affects:
    - src/app/(protected)/(profile)/perfil/page.tsx
    - src/app/(protected)/(explore)/explorar/_components/record-search-card.tsx
    - src/app/(protected)/(feed)/feed/_components/radar-section.tsx
    - src/app/(protected)/radar/page.tsx
    - src/app/release/[discogsId]/page.tsx
tech_stack:
  added: []
  patterns:
    - CollectionGridWithCrates client wrapper pattern — passes renderAction callback from client to server-rendered grid
    - AddToCratePopover mirrors QuickNotePopover @base-ui/react Popover pattern exactly
    - coverImageUrl={null} fallback for RadarMatch (type lacks release cover; only has user avatar)
key_files:
  created:
    - src/components/crates/add-to-crate-popover.tsx
    - src/components/crates/add-to-crate-button.tsx
    - src/app/(protected)/(profile)/perfil/_components/collection-grid-with-crates.tsx
    - src/app/release/[discogsId]/_components/release-actions.tsx
  modified:
    - src/app/(protected)/(explore)/explorar/_components/record-search-card.tsx
    - src/app/(protected)/(feed)/feed/_components/radar-section.tsx
    - src/app/(protected)/radar/page.tsx
    - src/app/release/[discogsId]/page.tsx
    - src/app/(protected)/(profile)/perfil/page.tsx (already updated by Plan 13-02 parallel commit)
decisions:
  - CollectionGridWithCrates client wrapper created to allow renderAction function prop across RSC boundary — server components cannot pass function props to client components
  - RadarMatch coverImageUrl passed as null — RadarMatch type from radar-queries.ts exposes matchAvatarUrl (user avatar) not release coverImageUrl; crate item stored without cover from radar entry point
  - getUserCratesAction response shape is { success, data?, error? } (from Plan 13-01) — popover accesses result.data ?? []
metrics:
  duration: "~15 minutes"
  completed: "2026-03-29"
  tasks_completed: 2
  files_created: 4
  files_modified: 5
---

# Phase 13 Plan 03: AddToCratePopover + Entry Points Summary

AddToCratePopover (base-ui Popover listing crates + inline create) with AddToCrateButton trigger injected across all 4 required surfaces: CollectionCard (own perfil), RadarMatch (feed + radar page), RecordSearchCard (explorar), and release page.

## What Was Built

### Task 1: AddToCratePopover + AddToCrateButton components

**`src/components/crates/add-to-crate-popover.tsx`** — Client component following the QuickNotePopover @base-ui/react pattern:
- `Popover` + `PopoverTrigger` + `PopoverContent` from `@/components/ui/popover`
- On open: calls `getUserCratesAction()`, populates crate list
- Crate list: tappable rows with crate name + item count; clicking calls `addToCrate` + toasts
- Inline create form: auto-shown when user has no crates; shown on-demand via `[+ New crate]`
- `[CREATE + ADD]` flow: `createCrate` → `addToCrate` in sequence → toast "Created and added to [name]"
- Loading spinner states for both initial load and per-crate add action

**`src/components/crates/add-to-crate-button.tsx`** — Client wrapper rendering `AddToCratePopover` with a `folder_open` icon button trigger.

**`getUserCratesAction`** — Already present in `src/actions/crates.ts` from Plan 13-01 (returns `{ success, data?, error? }`). No changes needed.

### Task 2: Entry Point Injections

**CollectionCard (own /perfil)**

Created `src/app/(protected)/(profile)/perfil/_components/collection-grid-with-crates.tsx` — a `"use client"` wrapper around `CollectionGrid` that provides `renderAction` callback with `AddToCrateButton`. Replaces direct `<CollectionGrid>` usage in `perfil/page.tsx` for the owner path.

The direct swap in `perfil/page.tsx` (line 477) was already applied by Plan 13-02's parallel commit — this plan verified the change is present.

**RecordSearchCard (`/explorar`)**

Added `<AddToCrateButton>` after the `VIEW_RELEASE` link inside the Info column, wrapped in a `<div className="mt-1">`. Receives `release.id`, `release.discogsId`, `release.title`, `release.artist`, `release.coverImageUrl`.

**RadarSection (feed) + RadarPage (`/radar`)**

Added `<AddToCrateButton>` in the Actions div of each match row (before `<LeadAction>`). Uses `match.releaseId`, `match.discogsId`, `match.releaseTitle`, `match.releaseArtist`. `coverImageUrl` is `null` — the `RadarMatch` type does not expose release cover art.

**Release page (`/release/[discogsId]`)**

Created `src/app/release/[discogsId]/_components/release-actions.tsx` — thin client component wrapping `AddToCrateButton` with release-level props. Rendered in `page.tsx` between `ReleaseHero` and `YouTubeEmbed` when `isAuthenticated === true`.

## Deviations from Plan

### Minor deviations (within plan scope)

**1. CollectionGridWithCrates client wrapper (not modifying CollectionGrid directly)**
- **Found during:** Task 2 implementation
- **Issue:** `renderAction` is a function prop — cannot be passed from a server component to client component across the RSC serialization boundary
- **Fix:** Created `CollectionGridWithCrates` ("use client") that wraps `CollectionGrid` and injects `AddToCrateButton` via `renderAction` — same end result without modifying `CollectionGrid`
- **Files modified:** New file `collection-grid-with-crates.tsx`, `perfil/page.tsx` updated to use it

**2. RadarMatch coverImageUrl = null**
- **Found during:** Task 2 (reading RadarMatch type in radar-queries.ts)
- **Issue:** `RadarMatch` type has `matchAvatarUrl` (user's avatar) but no `releaseAvatarUrl`/`coverImageUrl`. Release cover art is not in the radar query result
- **Fix:** Passed `coverImageUrl={null}` — crate item stored without cover from radar. Cover can be fetched later if needed
- **Files modified:** `radar-section.tsx`, `radar/page.tsx`

**3. getUserCratesAction response shape**
- **Found during:** Task 1 (reading existing actions/crates.ts)
- **Issue:** Plan spec shows `getUserCratesAction` returning `(CrateRow & { itemCount: number })[]` directly, but Plan 13-01 implemented it as `{ success, data?, error? }` wrapper
- **Fix:** Popover handles the `result.data ?? []` shape — consistent with all other crate actions in the file

## TypeScript Status

Zero TypeScript errors in all 7 new/modified files in this plan. Pre-existing errors in test files and other components are out of scope.

## Known Stubs

None. All components wire to real server actions. `coverImageUrl={null}` on RadarMatch is an intentional data limitation (source type doesn't expose it), not a stub.

## Commits

| Hash | Message |
|------|---------|
| d2ec65f | feat(13-03): add AddToCratePopover and AddToCrateButton components |
| a06f704 | feat(13-03): inject AddToCrateButton into all 4 entry points |

## Self-Check: PASSED
