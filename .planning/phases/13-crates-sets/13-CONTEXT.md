# Phase 13: Crates & Sets - Context

**Gathered:** 2026-03-29
**Status:** Ready for planning

<domain>
## Phase Boundary

Deliver a personal digging workspace: named crates for organizing record candidates before/during a session, plus sets for documenting played track orders with event metadata. Crates and sets are private to the owner in this phase.

Entry points into the workspace:
- `/crates` — list of all user's crates (accessible via `[MY_CRATES →]` link on own `/perfil` page)
- `/crates/[id]` — crate detail: items list + sets section + set builder panel
- `[ADD_TO_CRATE]` action on: CollectionCard, RadarMatch card, Explorar search result, release page

Out of scope for this phase:
- Public/shareable crate links (`/u/[username]/crate/[id]`) — deferred to future phase
- Crate Drop Link — deferred
- Social/feed activity for crate actions

</domain>

<decisions>
## Implementation Decisions

### D-01: Crate Workspace Location

- Route: `/crates` (list page) and `/crates/[id]` (crate detail)
- Entry point: `[MY_CRATES →]` link/button on own `/perfil` page — no 5th bottom nav tab
- Bottom navigation stays at 4 tabs (Feed, Explorar, Perfil, Comunidade)
- Route lives inside `(protected)` group — auth required, no public access in this phase

### D-02: Add-to-Crate UX

- `[ADD_TO_CRATE]` button on CollectionCard (via `renderAction` slot), RadarMatch card, Explorar search result card, and release page
- Clicking opens a `@base-ui/react` Popover listing existing crates (same Popover pattern as QuickNotePopover from Phase 10)
- Each crate shown as a tappable row: crate name + item count
- Bottom of the popover: `[+ New crate]` inline option
- **If user has no crates yet:** Popover shows only an inline name input + `[CREATE + ADD]` button — no empty state redirect needed

### D-03: Track Reorder in Sets

- Install `@dnd-kit/core` for drag-to-reorder (no DnD library currently in project)
- Used exclusively in the set builder panel on `/crates/[id]`
- Each track row has a drag handle icon (`⠿` or grip icon from lucide-react) on the left
- Drag updates a `position` integer column on the set_tracks table

### D-04: Crate Item Lifecycle (Move to Wantlist / Collection)

- Each crate item has a `status` field: `'active'` (default) | `'found'`
- When user moves an item to their wantlist or collection via the crate detail UI:
  1. Server action creates the wantlist/collection record
  2. Server action updates the crate item's `status` to `'found'`
  3. Item stays in the crate — visible with a `[FOUND]` status badge
- Item is NOT deleted from the crate — session history preserved
- `[FOUND]` items shown at the bottom of the crate items list or visually de-emphasized

### D-05: Set Creation Flow

- Sets live inside a crate — accessed from the crate detail page
- `[+ NEW SET]` button at bottom of `/crates/[id]` expands an inline panel (no full-page navigation)
- Set builder panel:
  1. Event metadata fields at top: date (defaults to today) + venue name (optional text)
  2. Track picker: checkboxes on each crate item to select tracks for the set
  3. Ordered track list with @dnd-kit drag handles to sequence them
  4. `[SAVE SET]` button creates the set
- Multiple sets can exist per crate (e.g. different nights from the same digging trip)
- Sets section rendered at the bottom of the crate detail page, collapsed by default, expandable

### D-06: Crate Privacy

- All crates are private — only the owner can see them
- RLS policies: SELECT/INSERT/UPDATE/DELETE only where `user_id = auth.uid()`
- No public route for crates in this phase
- Crate Drop Link (`/u/[username]/crate/[id]`) deferred to future phase

### D-07: Crate Metadata Schema

- **name**: required text (e.g. "Festa Sábado 05/04")
- **date**: date field, defaults to today (the session date, not createdAt)
- **session_type**: enum `'digging_trip' | 'event_prep' | 'wish_list' | 'other'`, default `'digging_trip'`
- **createdAt / updatedAt**: auto timestamps
- Crate card in list view shows: name, session_type chip, date, item count

### Claude's Discretion

- Exact SQL for crate items list ordering (active first, found last)
- Whether set tracks also store release metadata snapshot or just a FK to releases
- Pagination vs all-items display for crate detail (crates are personal/small, all-items is fine)
- Ghost Protocol visual treatment for `[FOUND]` status badge and `session_type` chip
- Whether @dnd-kit needs `@dnd-kit/sortable` or just `@dnd-kit/core` — planner to evaluate

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Phase Scope
- `.planning/ROADMAP.md` — Phase 13 goal and success criteria (CRATE-01 through CRATE-05)
- `.planning/REQUIREMENTS.md` — CRATE-01 through CRATE-05 definitions

### Schema (read before any migration)
- `src/lib/db/schema/collections.ts` — collectionItems table (pattern for crate item RLS)
- `src/lib/db/schema/wantlist.ts` — wantlistItems table (target when moving crate item to wantlist)
- `src/lib/db/schema/index.ts` — schema barrel export (add new crate tables here)
- `src/lib/db/schema/users.ts` — profiles table (for userId references)

### Existing UI Patterns (read before building new components)
- `src/app/globals.css` — Ghost Protocol design tokens (no new tokens allowed)
- `src/app/(protected)/(profile)/perfil/_components/collection-card.tsx` — renderAction slot pattern for [ADD_TO_CRATE] button
- `src/components/digger-memory/quick-note-popover.tsx` — @base-ui/react Popover pattern to replicate for AddToCratePopover
- `src/app/(protected)/(profile)/perfil/_components/add-to-wantlist-dialog.tsx` — dialog/action pattern for wantlist operations
- `src/app/(protected)/(profile)/perfil/page.tsx` — own profile page where [MY_CRATES →] link is added

### Phase 10 Context (Digger Memory primitives built there)
- `.planning/phases/10-positioning-radar-workspace/10-CONTEXT.md` — D-06 primitive component spec (QuickNotePopover, renderAction slot pattern)

### Entry Point Components (add [ADD_TO_CRATE] action here)
- `src/app/(protected)/(explore)/explorar/_components/` — search result cards
- `src/app/release/[discogsId]/` — release page (Phase 12)

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `CollectionCard` with `renderAction` slot — already extensible for per-card actions (Phase 9 pattern). Use this to add [ADD_TO_CRATE] without modifying the card internals.
- `@base-ui/react` Popover — already used in `QuickNotePopover`. Replicate the same pattern for `AddToCratePopover`.
- `wantlistItems` server actions (Phase 6) — reuse for "move to wantlist" from crate item
- `collectionItems` server actions (Phase 4) — reuse for "move to collection" from crate item
- `sonner` toast — used project-wide for feedback on actions
- `react-hook-form` + `@hookform/resolvers` — for crate create/edit forms

### Established Patterns
- Server actions for all mutations (never client-side fetch for writes)
- `font-mono` + `text-[10px]` for metadata labels
- `[UPPERCASE_STATUS]` terminal labels for states — e.g. `[FOUND]`, `[DIGGING_TRIP]`
- `surface-container-low` for card backgrounds
- Drizzle ORM with `db` client for queries, admin client for cross-user writes
- `SWR` for client-side caching of single-resource fetches (Phase 10 useDiggerMemory pattern)

### Integration Points
- `/perfil/page.tsx` (own profile) — add `[MY_CRATES →]` shortcut link
- `CollectionCard` renderAction slot — inject `AddToCrateButton` component
- RadarMatch card — inject `AddToCrateButton`
- Explorar search result cards — inject `AddToCrateButton`
- Release page (`/release/[discogsId]`) — add `[ADD_TO_CRATE]` in the actions area

</code_context>

<specifics>
## Specific Notes

- `@dnd-kit/core` (and likely `@dnd-kit/sortable`) must be installed. Evaluate if `@dnd-kit/utilities` is needed. All three are in the same `@dnd-kit` monorepo — small bundle impact.
- Session `date` on crate is the **digging session date**, not the DB `created_at`. It defaults to today but the user can change it. Stored as `date` type (not timestamp) since time-of-day is irrelevant.
- `session_type` enum values: `digging_trip`, `event_prep`, `wish_list`, `other` — stored as `text` with a CHECK constraint or Drizzle enum.
- Crate item `status` values: `active` | `found` — simple two-state. `found` is set when user moves item to wantlist or collection.
- Set tracks need a `position` integer for ordering. This is the field @dnd-kit updates on drag. Positions should be contiguous integers (1, 2, 3...) recomputed on save, not sparse.
- The `[+ NEW SET]` inline panel can be a client component mounted inside the server-rendered crate detail page. Use the collapsible/accordion pattern already established in the project (if any) or a simple `useState(open)` toggle.

</specifics>

<deferred>
## Deferred Ideas

- Crate Drop Link / public shareable crates (`/u/[username]/crate/[id]`) — future phase
- Crate activity in the feed (e.g. "X added 3 records to a crate") — future phase
- Collaborative crates (shared between users) — future phase
- Crate export (Discogs wantlist sync) — out of scope v1
- Set export (playlist format) — future phase

</deferred>

---

*Phase: 13-crates-sets*
*Context gathered: 2026-03-29*
