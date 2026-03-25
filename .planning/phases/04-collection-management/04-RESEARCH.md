# Phase 4: Collection Management - Research

**Researched:** 2026-03-25
**Domain:** Collection browsing UI, Discogs search integration, public profile routing, rarity scoring
**Confidence:** HIGH

## Summary

Phase 4 builds the collection browsing and management interface on top of the data already imported in Phase 3. The core work is: (1) a responsive card grid displaying collection items with rarity badges, (2) filter/sort controls, (3) a manual "Add Record" flow backed by Discogs API search, (4) condition grading CRUD, and (5) public profile page at `/perfil/[username]`.

The existing codebase provides strong foundations: the `collectionItems` and `releases` tables are already populated from Phase 3 imports, the Drizzle ORM client bypasses RLS for server-side reads, and shadcn/ui provides Card, Badge, Dialog, Input, DropdownMenu, and Skeleton components ready for use. The `@lionralfs/discogs-client` library exposes a typed `database().search()` method that returns `SearchResult` objects with `community.have`/`community.want`, `cover_image`, `title`, `genre`, `year`, `format`, and `country` -- all the data needed for the manual add flow.

**Primary recommendation:** Build the collection page as a Server Component with URL-based filter/sort state (searchParams), use the existing Drizzle `db` client for all reads (no Supabase client needed for server-side data), and implement the "Add Record" flow as a client-side Dialog that calls a server action for Discogs search and record insertion.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- **D-01:** Grid of cards layout on `/perfil` (and `/perfil/[username]` for public view). 3-4 columns responsive grid. Not a list view, not a table.
- **D-02:** Each card shows: cover art (primary visual), title, artist, rarity badge. Condition grade is NOT shown on the card -- only accessible on hover tooltip or record detail.
- **D-03:** Rarity displayed as a text badge -- `Common`, `Rare`, `Ultra Rare` -- not a number. Derived from `rarityScore` in the `releases` table (computed from Discogs have/want ratio).
- **D-04:** Horizontal filter chips row fixed below the page header, above the grid: `[ Genero v ] [ Decada v ] [ Formato v ] [ Ordenar v ]`. Each chip opens a dropdown.
- **D-05:** Genero filter maps to the `genre` array column on `releases`. Decada filter derives from `year` column (e.g., "80s" = 1980-1989). Formato filter maps to `format` column.
- **D-06:** Ordenar options: Rarity (default, Ultra Rare first), Date Added (newest first), Alphabetical (A-Z).
- **D-07:** FAB (Floating Action Button) in the bottom-right corner of the `/perfil` page triggers the "Add Record" flow. Not a top-bar button.
- **D-08:** Add record flow: search Discogs API first (by title/artist) -> user selects a release from results -> record is added to their collection as `addedVia = 'manual'`. Users do not fill in metadata manually -- they always pick from Discogs catalog.
- **D-09:** If a release already exists in the `releases` table (matched by `discogsId`), reuse the existing row. If not, create a new `releases` row from the Discogs API response, then insert a `collection_items` row.
- **D-10:** Condition grade (`conditionGrade` on `collection_items`) is editable on the record detail view or via a quick-edit on hover. Grades: Mint, VG+, VG, G+, G, F, P -- matching Discogs standard.
- **D-11:** Condition is NOT shown on collection grid cards (too cluttered). Only visible when the user inspects or edits a specific record.
- **D-12:** Rarity score is already stored as `rarityScore` (real) on the `releases` table, computed during Discogs import from `discogsWant / discogsHave`. Phase 4 only needs to READ this value and map it to label tiers: `>= 2.0` -> Ultra Rare, `>= 0.5` -> Rare, `< 0.5` -> Common, `null` -> no badge shown.
- **D-13:** Collection page is public -- any visitor (even unauthenticated) can browse `/perfil/[username]`. RLS already set to `select: true` for `collection_items` and `releases`.
- **D-14:** Own profile is at `/perfil` (redirects to `/perfil/[current_user_username]` or renders with user context). Both views use the same component.

### Claude's Discretion
- Exact card hover interaction design (how condition is revealed on hover)
- Dropdown filter component implementation (reuse shadcn Select or build custom chip dropdown)
- Empty collection state design (user has no records yet)
- Loading skeleton layout for the grid
- Pagination vs. infinite scroll for large collections (pick what's simpler)
- FAB exact position and animation on mobile
- Discogs search debounce and result display in the "Add Record" modal

### Deferred Ideas (OUT OF SCOPE)
- Collection value tracking over time -- COLL-V2-01 (v2 requirement)
- Export collection to CSV/PDF -- COLL-V2-02 (v2 requirement)
- Country filter -- COLL-04 mentions country but user chose Genero/Decada/Formato for chips; country can be added later as an advanced filter
- Bulk edit condition grades -- not requested, defer to backlog
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| COLL-01 | User has a public profile page showcasing their vinyl collection | Public `/perfil/[username]` route; Drizzle reads bypass RLS so unauthenticated visitors get data from Server Components; requires adding `username` column to `profiles` table (see Schema Gap section) |
| COLL-02 | Each record displays rarity score based on Discogs have/want ratio | `rarityScore` already on `releases` table; map to Common/Rare/Ultra Rare tiers per D-12; CRITICAL: current `computeRarityScore` caps at 1.0 but D-12 thresholds go to 2.0 -- formula must be updated (see Pitfall 1) |
| COLL-03 | User can add a record manually (not from Discogs) | Server action calling `client.database().search()` via `@lionralfs/discogs-client`; upsert release then insert `collection_items` row with `addedVia = 'manual'` |
| COLL-04 | User can filter collection by genre, decade, country, and format | Genre from `releases.genre[]` array, decade derived from `releases.year`, format from `releases.format`; country deferred per user decision. URL searchParams-driven for server-side filtering with Drizzle `where` clauses |
| COLL-05 | User can sort collection by rarity, date added, alphabetically | Drizzle `orderBy` on `releases.rarityScore` (desc nulls last), `collection_items.createdAt` (desc), `releases.title` (asc) |
| COLL-06 | User can mark physical condition (Mint through Poor) | `conditionGrade` column already exists on `collection_items`; server action to update via authenticated Drizzle or Supabase client |
</phase_requirements>

## Standard Stack

### Core (Already Installed)
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Next.js | 15.5.14 | App Router server components, dynamic routes | Already installed; Server Components ideal for data-heavy collection pages |
| React | 19.1.0 | UI rendering | Already installed (bundled by create-next-app) |
| Drizzle ORM | 0.45.x | Database queries for collection data | Already installed; SQL-like API for joins, filters, aggregations |
| @lionralfs/discogs-client | 4.1.4 | Discogs API search for manual add flow | Already installed; typed `database().search()` method |
| shadcn/ui | Latest | Card, Badge, Dialog, DropdownMenu, Input, Skeleton components | Already installed; components in `src/components/ui/` |
| Tailwind CSS | 4.x | Styling the collection grid, filter chips, FAB | Already configured with Ghost Protocol theme tokens |
| Zod | 4.3.x | Form/action input validation | Already installed; use for condition grade and search params validation |

### New Components to Add via shadcn CLI
| Component | Purpose | Install Command |
|-----------|---------|-----------------|
| Select | Filter chip dropdowns (Genero, Decada, Formato, Ordenar) | `npx shadcn@latest add select` |
| Popover | Condition grade quick-edit on card hover | `npx shadcn@latest add popover` |
| Tooltip | Condition display on hover if simpler than popover | `npx shadcn@latest add tooltip` |

**Recommendation for filter chips:** Use the existing `DropdownMenu` component for filter dropdowns. It already has `DropdownMenuCheckboxItem` and `DropdownMenuRadioItem` which map perfectly to multi-select genre filters and single-select sort options. No need to install `Select` -- the DropdownMenu already covers this use case with proper keyboard navigation and accessibility.

**Recommendation for condition edit:** Use `Popover` for the hover/click interaction that reveals the condition grade selector. A Popover anchors to the card and provides a small form overlay without navigating away.

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| URL searchParams for filters | Zustand client state | searchParams gives shareable URLs, SSR filtering, no hydration cost; Zustand would require client-side filtering which fails for large collections |
| Server-side pagination | Infinite scroll with TanStack Query | Pagination is simpler to implement, preserves URL state, works without JS; infinite scroll is better UX but adds complexity |
| DropdownMenu for filters | Custom chip dropdown component | DropdownMenu is already installed with full a11y; building custom would duplicate work |

## Architecture Patterns

### Recommended Project Structure
```
src/
  app/
    (protected)/
      (profile)/
        perfil/
          page.tsx                    # Own profile (authenticated, redirects or renders directly)
          [username]/
            page.tsx                  # Public profile (any visitor)
          _components/
            collection-grid.tsx       # Shared grid component (used by both routes)
            collection-card.tsx       # Individual record card
            filter-bar.tsx            # Horizontal filter chips row
            add-record-dialog.tsx     # FAB + search modal (client component)
            add-record-fab.tsx        # Floating action button (client component)
            condition-editor.tsx      # Popover for condition grade editing
            collection-skeleton.tsx   # Loading skeleton for grid
  actions/
    collection.ts                     # Server actions: searchDiscogs, addRecord, updateCondition
  lib/
    collection/
      rarity.ts                       # Rarity tier mapping: score -> Common/Rare/Ultra Rare
      filters.ts                      # Zod schemas for filter/sort params, decade mapping
```

### Pattern 1: URL-Based Filter State (Server Components)
**What:** Encode all filter and sort state in URL searchParams (`?genre=Jazz&decade=80s&sort=rarity`). The Server Component reads searchParams and builds Drizzle queries accordingly.
**When to use:** Collection page filtering -- must work without client-side JS, must produce shareable URLs.
**Example:**
```typescript
// src/app/(protected)/(profile)/perfil/[username]/page.tsx
import { db } from "@/lib/db";
import { collectionItems } from "@/lib/db/schema/collections";
import { releases } from "@/lib/db/schema/releases";
import { profiles } from "@/lib/db/schema/users";
import { eq, and, gte, lt, inArray, asc, desc } from "drizzle-orm";

interface Props {
  params: Promise<{ username: string }>;
  searchParams: Promise<{ genre?: string; decade?: string; format?: string; sort?: string; page?: string }>;
}

export default async function PublicProfilePage({ params, searchParams }: Props) {
  const { username } = await params;
  const filters = await searchParams;

  // Look up user by username
  const [profile] = await db
    .select()
    .from(profiles)
    .where(eq(profiles.username, username))
    .limit(1);

  if (!profile) notFound();

  // Build dynamic WHERE clauses
  const conditions = [eq(collectionItems.userId, profile.id)];

  if (filters.genre) {
    // PostgreSQL array contains operator via sql template
    conditions.push(sql`${releases.genre} @> ARRAY[${filters.genre}]`);
  }

  if (filters.decade) {
    const startYear = parseInt(filters.decade); // e.g., 1980
    conditions.push(gte(releases.year, startYear));
    conditions.push(lt(releases.year, startYear + 10));
  }

  // ... build query with conditions and sort
}
```

### Pattern 2: Server Action for Discogs Search
**What:** A server action wraps the Discogs API client for search. The client component (Add Record Dialog) calls this action with debounced input.
**When to use:** Manual record addition -- user searches Discogs, selects a result, and the action inserts the record.
**Example:**
```typescript
// src/actions/collection.ts
"use server";

import { createDiscogsClient } from "@/lib/discogs/client";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

export async function searchDiscogs(query: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");

  const client = await createDiscogsClient(user.id);
  const { data } = await client.database().search({
    query,
    type: "release",
    per_page: 10,
  });

  return data.results.map((r) => ({
    discogsId: r.id,
    title: r.title,
    coverImage: r.cover_image || r.thumb,
    year: r.year,
    format: r.format?.[0] || null,
    genre: r.genre || [],
    country: r.country || null,
    have: r.community?.have ?? 0,
    want: r.community?.want ?? 0,
  }));
}
```

### Pattern 3: Shared Collection Grid Component
**What:** A single `CollectionGrid` component used by both `/perfil` (own profile) and `/perfil/[username]` (public profile). The only difference is whether edit controls (FAB, condition editor) are shown.
**When to use:** Both profile views share identical data display logic.
**Example:**
```typescript
// Both pages pass isOwner to control edit affordances
<CollectionGrid
  items={collectionWithReleases}
  isOwner={isOwner}
  filters={currentFilters}
/>
```

### Anti-Patterns to Avoid
- **Client-side filtering of large datasets:** Never fetch all collection items to the client and filter in JS. A user with 5000 records would download megabytes of data. Always filter server-side with Drizzle WHERE clauses.
- **Using Supabase client for server-side reads:** The Drizzle `db` instance already bypasses RLS and is the established pattern. Don't mix in Supabase client reads for collection data.
- **Fetching Discogs data on the client:** The `@lionralfs/discogs-client` requires OAuth secrets. It must only run server-side in server actions. Never import it in a `"use client"` component.
- **Storing filter state in Zustand or React state alone:** This breaks URL sharing and SSR. Use URL searchParams as the source of truth for filters.

## Schema Gap: Missing `username` Column

**CRITICAL FINDING:** The `profiles` table does NOT have a `username` column. It only has `displayName`, `discogsUsername`, and `id`. The CONTEXT.md decisions D-13 and D-14 require `/perfil/[username]` for public profile URLs.

**Impact:** Phase 4 MUST add a `username` column to the `profiles` table before the public profile route can work.

**Requirements for the `username` column:**
- Type: `varchar(30)` with a UNIQUE constraint
- Must be URL-safe (alphanumeric + hyphens, lowercase)
- Required for all users (not nullable -- existing users need a default value)
- Migration strategy: generate username from `displayName` or `id` for existing users; require username during onboarding for new users (but onboarding change is out of Phase 4 scope -- use a generated default)

**Drizzle migration:**
```typescript
// In src/lib/db/schema/users.ts, add to profiles table:
username: varchar("username", { length: 30 }).unique(),
```

Then run `drizzle-kit generate` + `drizzle-kit migrate` + a data migration script to populate existing rows.

**Confidence:** HIGH -- verified by reading the schema directly; no `username` column exists.

## Rarity Score Formula Conflict

**CRITICAL FINDING:** The current `computeRarityScore` function in `src/lib/discogs/client.ts` caps the score at `1.0`:

```typescript
export function computeRarityScore(have, want): number | null {
  if (h === 0 && w === 0) return null;
  if (h === 0) return 1.0; // Maximum rarity
  return Math.min(1.0, w / h); // Capped at 1.0
}
```

But CONTEXT.md D-12 defines tier thresholds that go up to `2.0`:
- `>= 2.0` -> Ultra Rare
- `>= 0.5` -> Rare
- `< 0.5` -> Common

**The conflict:** With the current formula, `rarityScore` can never exceed 1.0, so no record can ever be "Ultra Rare" (which requires >= 2.0). The `Math.min(1.0, ...)` cap must be removed so the want/have ratio can exceed 1.0.

**Resolution options:**
1. **Update the formula:** Remove the `Math.min(1.0, ...)` cap so `rarityScore = want / have` can be any positive number. This requires updating existing `rarityScore` values in the database for records where `want > have`.
2. **Update the tier thresholds:** Adjust D-12 thresholds to fit within 0-1 range (e.g., >= 0.8 = Ultra Rare).

**Recommendation:** Option 1 -- update the formula. The user's D-12 decision explicitly states `>= 2.0` for Ultra Rare, meaning they expect scores above 1.0. The formula change is a one-line edit plus a data migration to recompute existing scores.

**Confidence:** HIGH -- verified by reading the function source code and the CONTEXT.md decision.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Filter dropdowns | Custom dropdown from scratch | `DropdownMenu` from shadcn/ui (already installed) | Full a11y, keyboard nav, checkbox/radio items, animations -- all built in |
| Card grid responsive layout | CSS Grid from scratch | Tailwind `grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4` | One line of CSS, responsive out of the box |
| Debounced search input | Custom debounce hook | `setTimeout`/`clearTimeout` in a `useCallback` (3 lines) or install `use-debounce` | Simple enough for inline; no library needed for a single input |
| Image placeholders | Custom image component | Next.js `<Image>` with `placeholder="blur"` or a fallback div | Handles lazy loading, sizing, format optimization |
| URL searchParams parsing | Manual string parsing | Zod schema `.parse(searchParams)` with defaults | Type-safe, validated, with sensible defaults for missing params |
| Pagination | Custom pagination logic | Drizzle `.limit(N).offset(page * N)` + a simple Pagination component | SQL-level pagination prevents loading all data |

**Key insight:** This phase is primarily a data presentation layer. The database schema and data already exist from Phase 3. The main work is building UI components that read and display data, plus the "Add Record" server action. No new infrastructure is needed.

## Common Pitfalls

### Pitfall 1: Rarity Score Cap Prevents Ultra Rare
**What goes wrong:** The `computeRarityScore` function caps at 1.0, making Ultra Rare (>= 2.0 threshold) impossible.
**Why it happens:** The Phase 3 implementation chose to normalize scores to a 0-1 range, but the Phase 4 decisions expect raw want/have ratios.
**How to avoid:** Remove the `Math.min(1.0, ...)` cap and recompute all existing `rarityScore` values in the database. Do this BEFORE building the rarity badge display.
**Warning signs:** All records show as "Rare" or "Common" but never "Ultra Rare."

### Pitfall 2: Missing username Column Blocks Public Profile
**What goes wrong:** The `/perfil/[username]` route cannot resolve a user because `profiles.username` does not exist.
**Why it happens:** The schema was designed before the public profile URL pattern was decided.
**How to avoid:** Add the `username` column with a Drizzle migration FIRST, before building the public profile page. Include a data migration for existing rows.
**Warning signs:** 404 on all `/perfil/[username]` URLs.

### Pitfall 3: PostgreSQL Array Contains for Genre Filtering
**What goes wrong:** Using `eq()` on the `genre` array column matches the entire array, not individual elements. Querying for `genre = 'Jazz'` fails because `genre` stores `['Jazz', 'Bop']`.
**Why it happens:** PostgreSQL arrays require the `@>` (contains) operator for element-level matching.
**How to avoid:** Use Drizzle's `sql` template for array contains: `sql\`${releases.genre} @> ARRAY[${genre}]::text[]\``. Alternatively, use `arrayContains` if available in Drizzle 0.45+.
**Warning signs:** Genre filter returns no results even though records with that genre exist.

### Pitfall 4: N+1 Query for Collection Items + Releases
**What goes wrong:** Fetching collection items then individually fetching each release creates N+1 database queries.
**Why it happens:** Naive implementation: fetch collection_items, then for each item fetch the release.
**How to avoid:** Use a JOIN in a single Drizzle query:
```typescript
const items = await db
  .select({
    id: collectionItems.id,
    conditionGrade: collectionItems.conditionGrade,
    addedVia: collectionItems.addedVia,
    createdAt: collectionItems.createdAt,
    title: releases.title,
    artist: releases.artist,
    coverImageUrl: releases.coverImageUrl,
    rarityScore: releases.rarityScore,
    genre: releases.genre,
    year: releases.year,
    format: releases.format,
  })
  .from(collectionItems)
  .innerJoin(releases, eq(collectionItems.releaseId, releases.id))
  .where(eq(collectionItems.userId, userId));
```
**Warning signs:** Page loads slowly for users with 100+ records; multiple sequential database queries in server logs.

### Pitfall 5: FAB Z-Index Conflict with Bottom Bar
**What goes wrong:** The FAB disappears behind the bottom navigation bar or overlaps navigation items.
**Why it happens:** The BottomBar uses `z-40` and `position: fixed`. The FAB also needs `position: fixed` and must be positioned above the bar.
**How to avoid:** Position the FAB with `fixed bottom-[calc(64px+16px+env(safe-area-inset-bottom,0px))] right-4 z-40`. The 64px accounts for the BottomBar height, 16px for spacing. Use the same z-index since it is horizontally separated.
**Warning signs:** FAB not visible on mobile; FAB blocks bottom nav items.

### Pitfall 6: Discogs Search Rate Limiting in Add Record
**What goes wrong:** Rapid typing in the search input triggers too many Discogs API requests, hitting the 60 req/min rate limit.
**Why it happens:** Each keystroke fires a server action that calls the Discogs API.
**How to avoid:** Debounce the search input by 300-500ms on the client side. Only fire the server action after the user stops typing. Show a loading state during the debounce/fetch cycle.
**Warning signs:** 429 errors from Discogs API; search results stop appearing mid-session.

### Pitfall 7: Unauthenticated Access to Public Profile
**What goes wrong:** The `/perfil/[username]` page returns a redirect to `/signin` for unauthenticated visitors.
**Why it happens:** The page is nested under the `(protected)` layout which checks `supabase.auth.getUser()` and redirects to `/signin`.
**How to avoid:** The `/perfil/[username]` public profile route must be placed OUTSIDE the `(protected)` layout group, OR the protected layout must be modified to allow unauthenticated access for the profile route. The cleanest approach: create `/perfil/[username]` as a top-level route outside `(protected)` that reads data via Drizzle (which bypasses RLS). Keep `/perfil` (own profile, with edit controls) inside `(protected)`.
**Warning signs:** Sharing a profile URL with a non-logged-in user shows the sign-in page instead of the collection.

## Code Examples

### Rarity Tier Mapping
```typescript
// src/lib/collection/rarity.ts
export type RarityTier = "Ultra Rare" | "Rare" | "Common" | null;

export function getRarityTier(score: number | null): RarityTier {
  if (score === null || score === undefined) return null;
  if (score >= 2.0) return "Ultra Rare";
  if (score >= 0.5) return "Rare";
  return "Common";
}

export function getRarityBadgeVariant(tier: RarityTier): string {
  switch (tier) {
    case "Ultra Rare": return "destructive"; // Stands out with red/orange
    case "Rare": return "default";           // Primary green
    case "Common": return "secondary";       // Muted blue
    default: return "outline";
  }
}
```

### Decade Filter Mapping
```typescript
// src/lib/collection/filters.ts
export const DECADES = [
  { label: "50s", startYear: 1950 },
  { label: "60s", startYear: 1960 },
  { label: "70s", startYear: 1970 },
  { label: "80s", startYear: 1980 },
  { label: "90s", startYear: 1990 },
  { label: "00s", startYear: 2000 },
  { label: "10s", startYear: 2010 },
  { label: "20s", startYear: 2020 },
] as const;

export function getDecadeRange(decade: string): { start: number; end: number } | null {
  const entry = DECADES.find((d) => d.label === decade);
  if (!entry) return null;
  return { start: entry.startYear, end: entry.startYear + 10 };
}
```

### Collection Query with Filters and Sorting
```typescript
// Server Component query pattern
import { db } from "@/lib/db";
import { collectionItems } from "@/lib/db/schema/collections";
import { releases } from "@/lib/db/schema/releases";
import { eq, and, gte, lt, asc, desc, sql } from "drizzle-orm";

const PAGE_SIZE = 24; // 4 columns x 6 rows

async function getCollection(userId: string, filters: ParsedFilters, page: number) {
  const conditions = [eq(collectionItems.userId, userId)];

  if (filters.genre) {
    conditions.push(sql`${releases.genre} @> ARRAY[${filters.genre}]::text[]`);
  }
  if (filters.decade) {
    conditions.push(gte(releases.year, filters.decade.start));
    conditions.push(lt(releases.year, filters.decade.end));
  }
  if (filters.format) {
    conditions.push(eq(releases.format, filters.format));
  }

  // Sort mapping
  const sortMap = {
    rarity: desc(sql`COALESCE(${releases.rarityScore}, -1)`),
    date: desc(collectionItems.createdAt),
    alpha: asc(releases.title),
  };
  const orderBy = sortMap[filters.sort] ?? sortMap.rarity;

  const items = await db
    .select({
      id: collectionItems.id,
      conditionGrade: collectionItems.conditionGrade,
      addedVia: collectionItems.addedVia,
      createdAt: collectionItems.createdAt,
      releaseId: releases.id,
      discogsId: releases.discogsId,
      title: releases.title,
      artist: releases.artist,
      year: releases.year,
      genre: releases.genre,
      format: releases.format,
      coverImageUrl: releases.coverImageUrl,
      rarityScore: releases.rarityScore,
    })
    .from(collectionItems)
    .innerJoin(releases, eq(collectionItems.releaseId, releases.id))
    .where(and(...conditions))
    .orderBy(orderBy)
    .limit(PAGE_SIZE)
    .offset(page * PAGE_SIZE);

  return items;
}
```

### Add Record Server Action (Upsert Pattern)
```typescript
// src/actions/collection.ts - follows import-worker.ts upsert pattern
"use server";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createDiscogsClient } from "@/lib/discogs/client";
import { computeRarityScore } from "@/lib/discogs/client";

export async function addRecordToCollection(discogsId: number) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");

  const admin = createAdminClient();

  // Check if release already exists in our DB
  const { data: existingRelease } = await admin
    .from("releases")
    .select("id")
    .eq("discogs_id", discogsId)
    .maybeSingle();

  let releaseId: string;

  if (existingRelease) {
    releaseId = existingRelease.id;
  } else {
    // Fetch full release data from Discogs API
    const client = await createDiscogsClient(user.id);
    const { data: release } = await client.database().getRelease(discogsId);

    // Insert release via admin client (same pattern as import-worker.ts)
    const { data: newRelease, error } = await admin
      .from("releases")
      .insert({
        discogs_id: release.id,
        title: release.title,
        artist: release.artists?.[0]?.name ?? "Unknown",
        year: release.year || null,
        genre: release.genres || [],
        style: release.styles || [],
        format: release.formats?.[0]?.name || null,
        country: release.country || null,
        cover_image_url: release.images?.[0]?.uri || null,
        discogs_have: release.community?.have ?? 0,
        discogs_want: release.community?.want ?? 0,
        rarity_score: computeRarityScore(
          release.community?.have ?? 0,
          release.community?.want ?? 0
        ),
        updated_at: new Date().toISOString(),
      })
      .select("id")
      .single();

    if (error || !newRelease) throw new Error("Failed to insert release");
    releaseId = newRelease.id;
  }

  // Check for duplicate in user's collection
  const { data: existing } = await admin
    .from("collection_items")
    .select("id")
    .eq("user_id", user.id)
    .eq("release_id", releaseId)
    .maybeSingle();

  if (existing) {
    return { error: "Record already in your collection" };
  }

  // Insert collection item
  await admin.from("collection_items").insert({
    user_id: user.id,
    release_id: releaseId,
    added_via: "manual",
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  });

  return { success: true };
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Next.js Pages Router `getServerSideProps` | App Router Server Components with `searchParams` | Next.js 13+ (2023) | Filter state lives in URL; no client-side data fetching needed for initial render |
| Client-side filtering with useEffect | Server-side filtering with Drizzle WHERE clauses | Current best practice | No large data transfers; works without JS; shareable filter URLs |
| Image `<img>` tags | Next.js `<Image>` component | Standard since Next.js 10 | Automatic optimization, lazy loading, responsive sizing |

## Open Questions

1. **Public profile route placement**
   - What we know: The `(protected)` layout redirects unauthenticated users to `/signin`. The public profile must be accessible to anyone.
   - What's unclear: Whether to place `/perfil/[username]` outside the `(protected)` group (cleaner, but loses the AppShell layout) or modify the protected layout to conditionally skip auth checks.
   - Recommendation: Place the public profile route at `src/app/perfil/[username]/page.tsx` (outside `(protected)`). It renders a minimal shell (header only, no sidebar/bottom nav for non-authenticated visitors). The authenticated `/perfil` route stays inside `(protected)` and uses the full AppShell.

2. **Username generation for existing users**
   - What we know: Existing users have `displayName` but no `username`. Some users may not have displayName set.
   - What's unclear: What the default username format should be.
   - Recommendation: Generate from `displayName` (lowercased, spaces to hyphens, special chars stripped) with a random 4-digit suffix for uniqueness. For users without displayName, use `digger-XXXX` where XXXX is random. Run as a one-time migration.

3. **Pagination page size**
   - What we know: Grid is 3-4 columns wide. D-01 specifies 3-4 columns.
   - What's unclear: How many rows per page.
   - Recommendation: 24 items per page (4 columns x 6 rows on desktop, 2 columns x 12 rows on mobile). This balances load time and scroll depth. Use simple page-based pagination (not infinite scroll) for URL shareability and simplicity.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest 4.1.x + @testing-library/react 16.3.x |
| Config file | `vitest.config.ts` (exists, configured with jsdom + react plugin) |
| Quick run command | `npx vitest run --reporter=verbose` |
| Full suite command | `npx vitest run && npx playwright test` |

### Phase Requirements -> Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| COLL-01 | Public profile page renders collection for any visitor | unit + integration | `npx vitest run tests/unit/components/collection/collection-grid.test.tsx -t "renders collection" && npx vitest run tests/integration/collection/public-profile.test.ts -t "unauthenticated"` | Wave 0 |
| COLL-02 | Rarity badge displays correct tier based on score | unit | `npx vitest run tests/unit/lib/collection/rarity.test.ts` | Wave 0 |
| COLL-03 | Manual add flow: search -> select -> insert | unit + integration | `npx vitest run tests/unit/components/collection/add-record-dialog.test.tsx && npx vitest run tests/integration/collection/add-record.test.ts` | Wave 0 |
| COLL-04 | Filter by genre/decade/format produces correct results | unit | `npx vitest run tests/unit/lib/collection/filters.test.ts` | Wave 0 |
| COLL-05 | Sort by rarity/date/alpha orders correctly | integration | `npx vitest run tests/integration/collection/sort.test.ts` | Wave 0 |
| COLL-06 | Condition grade update persists | integration | `npx vitest run tests/integration/collection/condition.test.ts` | Wave 0 |

### Sampling Rate
- **Per task commit:** `npx vitest run --reporter=verbose`
- **Per wave merge:** `npx vitest run && npx playwright test`
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps
- [ ] `tests/unit/lib/collection/rarity.test.ts` -- covers COLL-02 (rarity tier mapping)
- [ ] `tests/unit/lib/collection/filters.test.ts` -- covers COLL-04 (decade mapping, genre parsing)
- [ ] `tests/unit/components/collection/collection-grid.test.tsx` -- covers COLL-01 (grid rendering)
- [ ] `tests/unit/components/collection/add-record-dialog.test.tsx` -- covers COLL-03 (search + select UI)
- [ ] `tests/integration/collection/add-record.test.ts` -- covers COLL-03 (server action: search + insert)
- [ ] `tests/integration/collection/condition.test.ts` -- covers COLL-06 (condition update action)
- [ ] `tests/integration/collection/public-profile.test.ts` -- covers COLL-01 (unauthenticated access)
- [ ] `tests/integration/collection/sort.test.ts` -- covers COLL-05 (sort ordering)

## Environment Availability

Step 2.6: No new external dependencies required. Phase 4 uses only libraries already installed in the project (Next.js, Drizzle, @lionralfs/discogs-client, shadcn/ui components). The Discogs API and Supabase services are already configured from Phase 3.

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| @lionralfs/discogs-client | Discogs search for manual add | Yes | 4.1.4 | -- |
| Drizzle ORM | Collection queries | Yes | 0.45.x | -- |
| Drizzle Kit | Schema migration for username column | Yes | 0.31.10 | -- |
| shadcn/ui components | UI (Card, Badge, Dialog, DropdownMenu) | Yes | Installed | -- |
| Popover (shadcn) | Condition grade editor | No | -- | Install via `npx shadcn@latest add popover` |

**Missing dependencies with no fallback:** None.

**Missing dependencies with fallback:**
- shadcn Popover component: not yet installed but trivially added via CLI.

## Project Constraints (from CLAUDE.md)

- **Stack:** Next.js 15.x, React 19.1.0, TypeScript, Supabase, Drizzle ORM, Tailwind CSS 4.x, shadcn/ui
- **P2P:** WebRTC only -- not relevant to Phase 4
- **Discogs API:** Subject to rate limits (60 req/min authenticated) -- manual add search must be debounced
- **Security:** OWASP Top 10 coverage -- server actions must validate input, prevent IDOR
- **Frontend:** Claude aesthetics / Ghost Protocol theme -- use existing design tokens from `globals.css`
- **Solo developer:** Architecture must favor simplicity -- no over-engineering
- **Established patterns:** `getClaims()` not `getSession()` for auth validation; server actions in `src/actions/`; admin client for RLS bypass; Biome for linting; Vitest for unit tests; Playwright for E2E
- **GSD workflow:** Do not make direct repo edits outside a GSD workflow

## Sources

### Primary (HIGH confidence)
- `src/lib/db/schema/collections.ts` -- verified `collectionItems` schema, RLS policies, column types
- `src/lib/db/schema/releases.ts` -- verified `releases` schema, `rarityScore` column, RLS policies
- `src/lib/db/schema/users.ts` -- verified `profiles` schema; confirmed NO `username` column exists
- `src/lib/discogs/client.ts` -- verified `computeRarityScore` function caps at 1.0
- `src/lib/discogs/import-worker.ts` -- verified upsert pattern for releases + collection_items
- `src/actions/discogs.ts` -- verified server action patterns (admin client usage, auth checks)
- `node_modules/@lionralfs/discogs-client/types/database.d.ts` -- verified `SearchResult` type with `community.have`/`community.want`, `SearchParameters` type with `query`/`type` fields
- `src/components/ui/` -- verified available components: badge, card, dialog, dropdown-menu, input, skeleton
- `src/app/(protected)/(profile)/perfil/page.tsx` -- verified existing stub with Phase 4 placeholder
- `src/app/(protected)/layout.tsx` -- verified protected layout redirects unauthenticated users
- `vitest.config.ts` -- verified test configuration (jsdom, tests/ directory, setup file)

### Secondary (MEDIUM confidence)
- [npm @lionralfs/discogs-client](https://www.npmjs.com/package/@lionralfs/discogs-client) -- API documentation for search method
- [GitHub lionralfs/discogs-client](https://github.com/lionralfs/discogs-client) -- README with code examples
- [Discogs API Documentation](https://www.discogs.com/developers) -- search endpoint parameters and community data

### Tertiary (LOW confidence)
- None -- all findings verified against source code and type definitions.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH -- all libraries already installed and verified in package.json
- Architecture: HIGH -- patterns derived from existing Phase 1-3 codebase patterns
- Pitfalls: HIGH -- all identified from direct code analysis (rarity cap, missing username, RLS behavior, N+1 queries)
- Schema gaps: HIGH -- verified by reading the actual schema files

**Research date:** 2026-03-25
**Valid until:** 2026-04-25 (stable -- no external dependency changes expected)
