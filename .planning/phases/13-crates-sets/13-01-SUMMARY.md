---
phase: 13-crates-sets
plan: "01"
subsystem: crates-data-layer
tags: [schema, drizzle, rls, server-actions, zod, typescript]
dependency_graph:
  requires: []
  provides:
    - crates Drizzle schema with 4 tables and private RLS
    - crates server actions (10 mutations + 1 read)
    - crates query functions (4 read-only)
    - crates Zod validation schemas (6)
    - crates TypeScript types (6)
  affects:
    - src/lib/db/schema/index.ts (barrel export updated)
tech_stack:
  added: []
  patterns:
    - Private RLS pattern — SELECT gated by userId = authUid (not sql`true`)
    - Drizzle check() constraint for varchar enum columns
    - Two-query assembly pattern for getSetsForCrate (avoids N+1 nested join)
    - getUserCratesAction read action pattern for client-component consumption
key_files:
  created:
    - src/lib/db/schema/crates.ts
    - src/lib/crates/types.ts
    - src/lib/crates/queries.ts
    - src/lib/validations/crates.ts
    - src/actions/crates.ts
    - src/tests/crates/crates-actions.test.ts
  modified:
    - src/lib/db/schema/index.ts
decisions:
  - Used Drizzle check() constraint (imported from drizzle-orm/pg-core) for sessionType and status enums — no prior usage in codebase but confirmed available
  - Used two-query + JS assembly pattern for getSetsForCrate to avoid complex multi-level join — cleaner and more maintainable than a single query with multiple joins
  - Used ZodError.issues[0] not .errors[0] — TypeScript caught this during verification; auto-fixed
  - getUserCratesAction added (not in plan tasks but required by plan interfaces section) to serve AddToCratePopover client component
metrics:
  duration: "~4 minutes"
  completed: "2026-03-29"
  tasks_completed: 2
  files_created: 6
  files_modified: 1
---

# Phase 13 Plan 01: Crates Data Layer Summary

Drizzle schema (4 tables), TypeScript types, read-only query functions, Zod validation schemas, and 11 server actions establishing the complete persistence layer for Phase 13's Crates & Sets feature.

## What Was Built

### Task 1: Drizzle Schema — 4 Tables with Private RLS

`src/lib/db/schema/crates.ts` — 4 Drizzle table definitions with full private RLS (all 4 CRUD operations gated by `userId = authUid`, no public SELECT):

| Table | Key columns | Constraints |
|-------|-------------|-------------|
| `crates` | id, userId, name, date, sessionType, createdAt, updatedAt | CHECK on sessionType enum |
| `crate_items` | id, crateId, userId, releaseId, discogsId, title, artist, coverImageUrl, status, createdAt | CHECK on status enum; FK to crates (cascade), FK to releases (nullable) |
| `sets` | id, crateId, userId, eventDate, venueName, createdAt, updatedAt | FK to crates (cascade) |
| `set_tracks` | id, setId, crateItemId, userId, position, createdAt | FK to sets (cascade), FK to crateItems (cascade) |

Each table has 4 private RLS policies (select/insert/update/delete). Total: 16 policies.

`src/lib/db/schema/index.ts` — `export * from "./crates"` added as last line.

### Task 2: Data Layer Files

**`src/lib/crates/types.ts`** — 6 exported TypeScript types:
- `CrateRow`, `CrateItemRow`, `SetRow`, `SetTrackRow` (InferSelectModel from Drizzle)
- `CrateWithItems`, `SetWithTracks` (composite types)

**`src/lib/crates/queries.ts`** — 4 exported read-only query functions:
- `getCrates(userId)` — left join for itemCount, ordered by date DESC
- `getCrateById(crateId, userId)` — single row or null
- `getCrateItems(crateId, userId)` — ordered active-first via CASE WHEN
- `getSetsForCrate(crateId, userId)` — two-query assembly (sets + tracks join crateItems)

**`src/lib/validations/crates.ts`** — 6 exported Zod schemas:
- `createCrateSchema`, `updateCrateSchema`, `addToCrateSchema`
- `crateItemIdSchema`, `createSetSchema`, `updateSetTracksSchema`

**`src/actions/crates.ts`** — 11 exported server actions ("use server"):
- `createCrate`, `updateCrate`, `deleteCrate`
- `addToCrate` (ownership check before insert)
- `moveToWantlist` (inserts wantlist row + marks item found)
- `moveToCollection` (inserts collection row + marks item found)
- `markAsFound`
- `createSet` (verifies all crateItemIds belong to crate, bulk inserts set_tracks)
- `updateSetTracks` (delete + re-insert with recomputed 1-based positions)
- `deleteSet`
- `getUserCratesAction` (read action for client components like AddToCratePopover)

**`src/tests/crates/crates-actions.test.ts`** — 7 `it.todo` test stubs for Plan 13-04.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] ZodError.issues not .errors**
- **Found during:** Task 2 TypeScript verification
- **Issue:** Called `.errors[0]` on ZodError but the TypeScript type only exposes `.issues[]` (`.errors` is a deprecated/non-standard alias not in the type definition)
- **Fix:** Changed all 5 occurrences in `src/actions/crates.ts` to use `.issues[0]?.message`
- **Files modified:** `src/actions/crates.ts`
- **Commit:** 62acea5

### Minor additions (within plan scope)

**1. getUserCratesAction added to actions file**
- The plan interfaces section references this function for AddToCratePopover; it was listed in the action spec but not explicitly in the task file list. Added it to complete the spec.

## TypeScript Status

Zero TypeScript errors in all 7 new/modified files. Pre-existing errors in test files and other components are out of scope.

## Known Stubs

None. All query functions return real data shapes from Drizzle. Server actions perform real DB operations. No placeholder values flow to rendering.

## Commits

| Hash | Message |
|------|---------|
| 751d328 | feat(13-01): add crates Drizzle schema — 4 tables with private RLS |
| 62acea5 | feat(13-01): add crates data layer — types, queries, validations, server actions |

## Self-Check: PASSED
