# Phase 4: Collection Management - Context

**Gathered:** 2026-03-25
**Status:** Ready for planning

<domain>
## Phase Boundary

Build the public collection profile page (`/perfil/[username]`) where users can browse, filter, sort, and showcase their vinyl collection with rarity context. Includes manual record entry (Discogs-backed search), physical condition grading, and rarity scoring derived from existing Discogs have/want data already imported in Phase 3. No social features (follow, compare) — that's Phase 5.

</domain>

<decisions>
## Implementation Decisions

### Collection Layout

- **D-01:** Grid of cards layout on `/perfil` (and `/perfil/[username]` for public view). 3–4 columns responsive grid. Not a list view, not a table.
- **D-02:** Each card shows: cover art (primary visual), title, artist, rarity badge. Condition grade is NOT shown on the card — only accessible on hover tooltip or record detail.
- **D-03:** Rarity displayed as a text badge — `Common`, `Rare`, `Ultra Rare` — not a number. Derived from `rarityScore` in the `releases` table (computed from Discogs have/want ratio).

### Filter and Sort UX

- **D-04:** Horizontal filter chips row fixed below the page header, above the grid: `[ Gênero ▾ ] [ Década ▾ ] [ Formato ▾ ] [ Ordenar ▾ ]`. Each chip opens a dropdown.
- **D-05:** Gênero filter maps to the `genre` array column on `releases`. Década filter derives from `year` column (e.g., "80s" = 1980–1989). Formato filter maps to `format` column.
- **D-06:** Ordenar options: Rarity (default, Ultra Rare first), Date Added (newest first), Alphabetical (A–Z).

### Manual Record Entry

- **D-07:** FAB (Floating Action Button) in the bottom-right corner of the `/perfil` page triggers the "Add Record" flow. Not a top-bar button.
- **D-08:** Add record flow: search Discogs API first (by title/artist) → user selects a release from results → record is added to their collection as `addedVia = 'manual'`. Users do not fill in metadata manually — they always pick from Discogs catalog.
- **D-09:** If a release already exists in the `releases` table (matched by `discogsId`), reuse the existing row. If not, create a new `releases` row from the Discogs API response, then insert a `collection_items` row.

### Condition Grading

- **D-10:** Condition grade (`conditionGrade` on `collection_items`) is editable on the record detail view or via a quick-edit on hover. Grades: Mint, VG+, VG, G+, G, F, P — matching Discogs standard.
- **D-11:** Condition is NOT shown on collection grid cards (too cluttered). Only visible when the user inspects or edits a specific record.

### Rarity Score Formula

- **D-12:** Rarity score is already stored as `rarityScore` (real) on the `releases` table, computed during Discogs import from `discogsWant / discogsHave`. Phase 4 only needs to READ this value and map it to label tiers:
  - `>= 2.0` → Ultra Rare
  - `>= 0.5` → Rare
  - `< 0.5` → Common
  - `null` (no Discogs data) → no badge shown

### Public Profile Page

- **D-13:** Collection page is public — any visitor (even unauthenticated) can browse `/perfil/[username]`. RLS already set to `select: true` for `collection_items` and `releases`.
- **D-14:** Own profile is at `/perfil` (redirects to `/perfil/[current_user_username]` or renders with user context). Both views use the same component.

### Claude's Discretion

- Exact card hover interaction design (how condition is revealed on hover)
- Dropdown filter component implementation (reuse shadcn Select or build custom chip dropdown)
- Empty collection state design (user has no records yet)
- Loading skeleton layout for the grid
- Pagination vs. infinite scroll for large collections (pick what's simpler)
- FAB exact position and animation on mobile
- Discogs search debounce and result display in the "Add Record" modal

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Database Schema
- `src/lib/db/schema/collections.ts` — `collectionItems` table: `userId`, `releaseId`, `discogsInstanceId`, `conditionGrade`, `addedVia`, `createdAt`. RLS: select=all, insert/update/delete=own user only.
- `src/lib/db/schema/releases.ts` — `releases` table: `title`, `artist`, `year`, `genre[]`, `style[]`, `country`, `format`, `coverImageUrl`, `discogsHave`, `discogsWant`, `rarityScore`. RLS: select=all authenticated, insert/update=service role only.
- `src/lib/db/schema/users.ts` — `profiles` table: `displayName`, `avatarUrl`, `username` (used to build public profile URL `/perfil/[username]`).

### Project Requirements
- `.planning/REQUIREMENTS.md` §"Collection Management" — COLL-01 through COLL-06 acceptance criteria

### Discogs Integration (Phase 3, completed)
- `src/lib/discogs/import-worker.ts` — Shows how releases are upserted during import; manual entry must follow the same pattern
- `src/actions/discogs.ts` — Established pattern for Discogs server actions; manual-add action should live here or in a new `src/actions/collection.ts`

### UI Patterns (Phase 2 shell)
- `src/components/shell/app-header.tsx` — Header component (filter chips row sits below this)
- `src/components/shell/bottom-nav.tsx` — Bottom nav (FAB must float above this)
- `src/components/ui/` — Available: button, card, badge, dialog, select, input, separator

### Brand Reference
- `src/app/globals.css` — Dark theme tokens: `--background`, `--card`, `--primary` (blue), `--muted`, `--border`. Card grid must use `--card` background.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `src/components/ui/badge` — Use for rarity labels (Common/Rare/Ultra Rare) with variant styling
- `src/components/ui/card` — Base card shell for collection grid items
- `src/components/ui/dialog` — For the "Add Record" search modal
- `src/components/ui/input` — Search input inside the Add Record dialog
- `src/components/shell/empty-state.tsx` — Reuse for empty collection state
- `src/lib/discogs/import-worker.ts` — `processImportPage` shows upsert pattern for `releases` + `collectionItems`

### Established Patterns
- Server actions in `src/actions/` — all DB writes go through server actions (never client-side Drizzle)
- `getClaims()` not `getSession()` for all server-side auth validation
- Drizzle ORM with `prepare: false` (PgBouncer via Supabase)
- `@lionralfs/discogs-client` is server-side only — Discogs search in "Add Record" must be a server action
- Biome for linting, Vitest for unit tests, Playwright for E2E

### Integration Points
- `/perfil` route: currently exists as a tab in Phase 2 shell — Phase 4 builds the content of this page
- `src/app/(protected)/perfil/page.tsx` — Current stub; Phase 4 replaces with full collection grid
- `src/app/(protected)/perfil/[username]/page.tsx` — New route for public profile viewing

</code_context>

<specifics>
## Specific Ideas

- Filter chips style: minimal, outlined chips with a dropdown chevron. Matching the dark theme — `--border` color outline, `--foreground` text, `--muted` hover background.
- The FAB should float above the bottom nav bar (position: fixed, bottom offset accounts for nav height ~56px + 16px gap)
- The "Add Record" search modal should feel like a quick lookup — instant debounced search as the user types, results show cover art thumbnail + title + artist + year + format so they can pick the right pressing

</specifics>

<deferred>
## Deferred Ideas

- Collection value tracking over time — COLL-V2-01 (v2 requirement)
- Export collection to CSV/PDF — COLL-V2-02 (v2 requirement)
- Country filter — COLL-04 mentions country but user chose Gênero/Década/Formato for chips; country can be added later as an advanced filter
- Bulk edit condition grades — not requested, defer to backlog

</deferred>

---

*Phase: 04-collection-management*
*Context gathered: 2026-03-25*
