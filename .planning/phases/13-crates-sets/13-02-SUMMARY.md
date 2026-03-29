---
phase: 13-crates-sets
plan: "02"
subsystem: crates-ui-routes
tags: [nextjs, react, dnd-kit, server-components, client-components, tailwind, ghost-protocol]
dependency_graph:
  requires:
    - 13-01 (crates data layer — schema, queries, actions, types)
  provides:
    - /crates list route (server component + CrateCard + CreateCrateForm)
    - /crates/[id] detail route (server component + CrateItemRow + SetBuilderPanel + SetsSection)
    - [MY_CRATES →] entry point on own /perfil page
    - @dnd-kit drag-to-reorder in SetBuilderPanel
  affects:
    - src/app/(protected)/(profile)/perfil/page.tsx (added [MY_CRATES →] link)
tech_stack:
  added:
    - "@dnd-kit/core ^6.3.1"
    - "@dnd-kit/sortable ^10.0.0"
    - "@dnd-kit/utilities ^3.2.2"
  patterns:
    - Server component auth-gate pattern (createClient + getUser + redirect)
    - Client wrapper for toggle state in server-rendered page (CratesHeader, NewSetSection)
    - Ghost Protocol terminal labels — [DIGGING_TRIP], [EVENT_PREP], [WISH_LIST], [OTHER], [FOUND]
    - @dnd-kit/sortable SortableContext + useSortable + arrayMove pattern
    - Per-card isOpen state for collapsible sets in SetsSection
key_files:
  created:
    - src/app/(protected)/crates/layout.tsx
    - src/app/(protected)/crates/page.tsx
    - src/app/(protected)/crates/_components/crates-header.tsx
    - src/app/(protected)/crates/_components/crate-card.tsx
    - src/app/(protected)/crates/_components/create-crate-form.tsx
    - src/app/(protected)/crates/_components/crate-empty-state.tsx
    - src/app/(protected)/crates/[id]/page.tsx
    - src/app/(protected)/crates/[id]/_components/crate-item-row.tsx
    - src/app/(protected)/crates/[id]/_components/set-builder-panel.tsx
    - src/app/(protected)/crates/[id]/_components/sets-section.tsx
    - src/app/(protected)/crates/[id]/_components/new-set-section.tsx
  modified:
    - src/app/(protected)/(profile)/perfil/page.tsx
decisions:
  - Added CratesHeader client wrapper to manage isCreating state without making the server page a client component
  - Added NewSetSection client wrapper (same pattern) for the [+ NEW_SET] / SetBuilderPanel toggle
  - Session type chips in CrateCard use a Record<string, ...> lookup (not a switch) because sessionType is varchar (string | null), not a TypeScript enum
  - SetBuilderPanel shows ALL items (active + found) in track picker per spec context — found items can still be added to sets
metrics:
  duration: "~15 minutes"
  completed: "2026-03-29"
  tasks_completed: 2
  files_created: 11
  files_modified: 1
---

# Phase 13 Plan 02: Crates UI Routes Summary

Two Next.js routes under `(protected)` — `/crates` list page and `/crates/[id]` detail page — with Ghost Protocol terminal label styling, @dnd-kit sortable set builder, and a `[MY_CRATES →]` entry point on the own profile page.

## What Was Built

### Task 1: Install @dnd-kit + Crates list page

**Installed:** `@dnd-kit/core ^6.3.1`, `@dnd-kit/sortable ^10.0.0`, `@dnd-kit/utilities ^3.2.2`

**`src/app/(protected)/crates/layout.tsx`** — Simple max-width wrapper (`max-w-4xl mx-auto px-4 py-6`).

**`src/app/(protected)/crates/page.tsx`** — Server component: `createClient()` + auth redirect + `getCrates(user.id)`. Renders `CratesHeader` (client) + `CrateCard` list or `CrateEmptyState`.

**`src/app/(protected)/crates/_components/crates-header.tsx`** — Client wrapper managing `isCreating: boolean`. Shows `[WORKSPACE]` label + `Your Crates` heading + `[+ NEW_CRATE]` button that expands `CreateCrateForm` inline.

**`src/app/(protected)/crates/_components/crate-card.tsx`** — Client component with Link to `/crates/${crate.id}`. Session type displayed as terminal chips:
- `digging_trip` → `[DIGGING_TRIP]` text-primary border-primary/30
- `event_prep` → `[EVENT_PREP]` text-secondary border-secondary/30
- `wish_list` → `[WISH_LIST]` text-tertiary border-tertiary/30
- `other` → `[OTHER]` text-on-surface-variant border-outline-variant

**`src/app/(protected)/crates/_components/create-crate-form.tsx`** — Client component with react-hook-form + zodResolver(createCrateSchema). 4-button toggle group for sessionType, date input defaulting to today, name text input. Calls `createCrate()` action on submit, toasts on result, calls `router.refresh()` + `onSuccess?.()`.

**`src/app/(protected)/crates/_components/crate-empty-state.tsx`** — Client component with inline `CreateCrateForm` expand via `useState`.

**Modified `src/app/(protected)/(profile)/perfil/page.tsx`** — Added `[MY_CRATES →]` link (font-mono text-[10px] text-primary) in a `mt-4 flex justify-end` div before the `{/* Public Identity Controls */}` section.

### Task 2: Crate detail page

**`src/app/(protected)/crates/[id]/page.tsx`** — Server component: auth check + `getCrateById` (notFound if null) + `Promise.all([getCrateItems, getSetsForCrate])`. Renders breadcrumb, header with session chip + date, items list with `CrateItemRow`, `NewSetSection`, and `SetsSection`.

**`src/app/(protected)/crates/[id]/_components/crate-item-row.tsx`** — Client component. `opacity-50` on entire row when `status === "found"`. `[FOUND]` badge (text-tertiary border-tertiary/30) for found items. `[→ WANTLIST]` and `[→ COLLECTION]` action buttons for active items — call `moveToWantlist(item.id)` / `moveToCollection(item.id)` with toast + `router.refresh()`.

**`src/app/(protected)/crates/[id]/_components/set-builder-panel.tsx`** — Client component with full @dnd-kit sortable implementation:
- `DndContext` + `SortableContext` (verticalListSortingStrategy) + `useSortable` per track row
- `arrayMove` on `DragEndEvent` to reorder `trackOrder`
- `GripVertical` (lucide-react) drag handle
- Event date + venue name inputs side-by-side
- Checkbox track picker for all crate items
- `[SAVE_SET]` calls `createSet()`, disabled when no tracks selected or saving

**`src/app/(protected)/crates/[id]/_components/sets-section.tsx`** — Client component. Returns null if no sets. Each set card collapses/expands via per-card `useState(false)`, showing tracks with position number + title + artist.

**`src/app/(protected)/crates/[id]/_components/new-set-section.tsx`** — Client wrapper managing `isOpen` state to toggle between `[+ NEW_SET]` button and `SetBuilderPanel`.

## Deviations from Plan

### Minor additions (within plan scope)

**1. CratesHeader extracted as separate file**
- The plan described wrapping the header + form area in a client component. I extracted it into `crates-header.tsx` (separate file) rather than co-locating in `page.tsx` for cleaner file organization consistent with the project pattern.

**2. NewSetSection extracted as separate client wrapper**
- Same pattern as CratesHeader — extracted to `new-set-section.tsx` to keep the server page component clean. This matches the established client-wrapper pattern in the codebase.

None of these affect correctness or behavior.

## TypeScript Status

Zero TypeScript errors in all 11 new files and 1 modified file. Pre-existing errors in community queries, edit-profile-modal, and test files are out of scope.

## Known Stubs

None. All components render real data from the Plan 13-01 data layer. No placeholder values flow to UI rendering.

## Commits

| Hash | Message |
|------|---------|
| cebfd03 | feat(13-02): add crates list page — layout, CrateCard, CreateCrateForm, CrateEmptyState |
| 2a686ea | feat(13-02): add crate detail page — items, move actions, set builder, sets section |

## Self-Check: PASSED
