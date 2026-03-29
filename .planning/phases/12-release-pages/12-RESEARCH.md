# Phase 12: Release Pages - Research

**Researched:** 2026-03-29
**Domain:** Public SEO routes, YouTube Data API integration, Next.js 15 metadata, Drizzle ORM queries
**Confidence:** HIGH

## Summary

Phase 12 builds public, SEO-indexable release pages at `/release/[discogsId]`. Each page acts as the canonical hub for a record in the DigSwap universe: Discogs link, YouTube embed (auto-searched and cached), owners list with profile links, and all platform reviews. The phase also wires entry points from existing UI surfaces (CollectionCard, RadarMatch card, RecordSearchCard).

The existing codebase is remarkably well-prepared for this phase. The `releases` table already has a `youtubeVideoId` column (varchar(20), unique). The public route pattern from `/perfil/[username]` provides an exact template for the layout and auth-optional approach. The review query infrastructure (`getReviewsForRelease`, `getReviewCountForRelease`) is already built from Phase 7. The image configuration in `next.config.ts` already allows `i.discogs.com`, `st.discogs.com`, and `i.ytimg.com`. This phase is primarily assembly work -- connecting existing pieces with a new route and one new server action for YouTube search.

**Primary recommendation:** Use the YouTube Data API v3 `search.list` endpoint with a lazy-cache-on-first-visit pattern. The default quota of 10,000 units/day allows 100 searches/day. Since results are cached permanently on the `releases.youtube_video_id` column, quota consumption is bounded by the number of *unique* releases visited for the first time, which is manageable for an MVP. No separate cache table needed.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- Lazy search + long cache: first visit to a release page triggers a YouTube Data API search (artist + title), result cached in DB indefinitely
- Quota only consumed once per release -- subsequent visits serve from cache
- If no YouTube result found, section is hidden gracefully (no broken embed)
- Show profile cards: avatar + username + trust rating, top 12 by default
- "Ver todos" link opens full paginated owners list
- Same visual language as radar cards (consistent with existing design system)
- No inline REQUEST_TRADE button on release page -- trade initiation stays on profile pages
- NAV-04 + NOTF-05 already complete (quick task 260328-tef) -- skip in planning

### Claude's Discretion
- URL structure: /release/[discogsId] -- matches Discogs's own URL pattern, easy to SEO-link
- Navigation entry points: add "VIEW_RELEASE" links from CollectionCard, RadarMatch card, and ExplorarRecord search result card
- Reviews on release page: show all platform reviews for this release (existing review data from Phase 7), paginated if > 10

### Deferred Ideas (OUT OF SCOPE)
- Recommendations / related releases -- v2 (needs data density)
- "Currently trading" indicator on owner cards -- Phase 14 (Trade V2)
- Community group links on release page -- future
- Discogs price history embed -- out of scope (ToS concern)
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| REL-01 | Each release/record has a dedicated public page at /release/[discogsId] (SEO-indexable, no login required) | Public route pattern from `/perfil/[username]` layout provides exact template. Drizzle `db` client bypasses RLS, works without auth. `generateMetadata()` for SEO. |
| REL-02 | Release page shows a direct link to the corresponding Discogs release page | `releases.discogsId` column exists. Discogs URL format: `https://www.discogs.com/release/{discogsId}` |
| REL-03 | Release page embeds a YouTube video (auto-searched by artist + title, cached in DB to avoid quota burn) | `releases.youtubeVideoId` column already exists (varchar(20), unique). YouTube Data API v3 search.list at 100 units/call, 10K units/day = 100 searches/day. Server action caches result on first visit. |
| REL-04 | Release page lists all platform users who have this release in their collection with links to their profiles | `collection_items` join `profiles` where `release_id` = target release. Existing `OwnersList` component pattern from explorar RecordSearchCard. |
| REL-05 | Release page shows all reviews written for this release on the platform | `getReviewsForRelease(releaseId)` already exists in `src/lib/community/queries.ts`. Returns `ReviewItem[]` with cursor-based pagination. |
| NOTF-05 | Notification badge count resets to 0 after user reads all notifications -- no stale count | Already completed in quick task 260328-tef. SKIP. |
| NAV-04 | Trade icon appears in navbar beside notification bell with its own unread count | Already completed in quick task 260328-tef. SKIP. |
</phase_requirements>

## Project Constraints (from CLAUDE.md)

- **Stack:** Next.js 15.x, React 18.x, TypeScript, Supabase, Drizzle ORM, Tailwind CSS 4.x, shadcn/ui
- **Database queries:** Use Drizzle `db` client (not Supabase client) for queries -- consistent with all existing query files
- **Admin mutations:** Use `createAdminClient()` for RLS-bypassing writes -- consistent with existing server actions
- **Icons:** Material Symbols (not lucide-react custom, not emoji)
- **Font:** JetBrains Mono for code/labels, Space Grotesk for headings, Inter for body
- **Testing:** Vitest (unit/integration), Playwright (E2E), tests in `tests/` directory
- **Linting:** Biome (not ESLint+Prettier)
- **P2P:** WebRTC only, no server-side file storage
- **Security:** Rate limit all server actions, validate all inputs with Zod

## Standard Stack

### Core (already installed, no new dependencies)
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Next.js | 15.5.x | App Router, Server Components, generateMetadata | Already installed, provides SSR for SEO |
| Drizzle ORM | 0.45.x | Database queries | Already installed, all existing queries use it |
| @supabase/supabase-js | Latest | Admin client for YouTube cache writes | Already installed, createAdminClient pattern |
| Tailwind CSS | 4.2.x | Styling | Already installed |

### New Dependencies Required
None. The YouTube Data API v3 is a REST API called via `fetch()`. No SDK needed.

**Installation:** No new packages to install.

## Architecture Patterns

### Recommended Project Structure
```
src/
  app/
    release/                    # NEW: public release route (outside (protected) group)
      [discogsId]/
        page.tsx               # Server Component - main release page
        _components/
          release-hero.tsx     # Cover art + title + metadata + Discogs link
          youtube-embed.tsx    # Client Component - iframe embed + lazy search trigger
          owners-section.tsx   # Server Component - owners list
          reviews-section.tsx  # Server Component - reviews list
      layout.tsx               # COPY pattern from src/app/perfil/layout.tsx
  lib/
    release/
      queries.ts               # NEW: getReleaseByDiscogsId, getOwnersByReleaseId
  actions/
    release.ts                 # NEW: searchYouTubeForRelease server action
```

### Pattern 1: Public Route with Optional Auth Layout
**What:** Route outside `(protected)` group with layout that conditionally renders AppShell for logged-in users or minimal header for visitors.
**When to use:** Any page that must be accessible without login but should show the full app shell for authenticated users.
**Source:** `src/app/perfil/layout.tsx` (already implemented for Phase 10)
```typescript
// src/app/release/layout.tsx -- COPY this exact pattern from perfil/layout.tsx
export default async function ReleaseLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  // NO redirect -- public route

  if (user) {
    const [profile] = await db
      .select({ displayName: profiles.displayName, avatarUrl: profiles.avatarUrl })
      .from(profiles)
      .where(eq(profiles.id, user.id))
      .limit(1);
    return (
      <AppShell
        user={{ id: user.id, displayName: profile?.displayName ?? null, avatarUrl: profile?.avatarUrl ?? null }}
        banner={<ImportBanner userId={user.id} />}
      >
        {children}
      </AppShell>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Minimal visitor header with SIGN_IN / START_DIGGING links */}
      {children}
    </div>
  );
}
```

### Pattern 2: generateMetadata for Dynamic SEO
**What:** Export `generateMetadata()` from the page file to produce per-release OG tags.
**When to use:** Any dynamic route that needs SEO/social sharing metadata.
**Source:** `src/app/u/[username]/bounty/page.tsx` (existing example in this codebase)
```typescript
export async function generateMetadata({ params }: ReleasePageProps): Promise<Metadata> {
  const { discogsId } = await params;
  const release = await getReleaseByDiscogsId(Number(discogsId));
  if (!release) return { title: "Release Not Found - DigSwap" };

  return {
    title: `${release.title} by ${release.artist} - DigSwap`,
    description: `${release.title} by ${release.artist}${release.year ? ` (${release.year})` : ""}. See who owns this release and read reviews on DigSwap.`,
    openGraph: {
      title: `${release.title} - ${release.artist}`,
      description: `Discover who has this record in their collection on DigSwap.`,
      images: release.coverImageUrl ? [{ url: release.coverImageUrl, width: 300, height: 300, alt: release.title }] : [],
      type: "music.album",
    },
  };
}
```

### Pattern 3: YouTube Lazy Cache via Server Action
**What:** On first page load, if `releases.youtubeVideoId` is null, trigger a server action to search YouTube and cache the result.
**When to use:** When you want to lazily populate data on first access without a background job.
```typescript
// src/actions/release.ts
"use server";
export async function searchYouTubeForRelease(releaseId: string): Promise<{ videoId: string | null }> {
  // 1. Fetch release from DB
  // 2. If youtubeVideoId already set, return it (cache hit)
  // 3. Call YouTube Data API v3 search.list
  // 4. Write result to releases.youtube_video_id via admin client
  // 5. Return videoId
}
```

### Pattern 4: Drizzle Query Bypassing RLS for Public Pages
**What:** The `db` Drizzle client uses `DATABASE_URL` directly (service role), bypassing RLS. All existing public pages (bounty, public profile) use this pattern.
**When to use:** Any server component that needs to read data regardless of auth state.
**Proof:** `src/lib/db/index.ts` connects via `postgres(process.env.DATABASE_URL!)` -- this is NOT the anon key, so RLS does not apply.

### Anti-Patterns to Avoid
- **Do NOT use Supabase client (`createClient()`) for data queries on public pages** -- its RLS policies only grant SELECT to `authenticatedRole`. Use Drizzle `db` instead.
- **Do NOT create a separate `youtube_cache` table** -- the `releases.youtubeVideoId` column already exists and is the right place.
- **Do NOT call YouTube API on every page load** -- cache indefinitely. Music videos don't change URLs.
- **Do NOT add REQUEST_TRADE button to the release page** -- per locked decision, trade initiation stays on profile pages.
- **Do NOT re-implement NAV-04 or NOTF-05** -- already shipped in quick task 260328-tef.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| YouTube embed | Custom video player | YouTube iframe embed (`<iframe src="https://www.youtube.com/embed/{videoId}">`) | Standard, handles all browser quirks, responsive, privacy-enhanced mode available |
| Review listing | Custom review query | `getReviewsForRelease()` from `src/lib/community/queries.ts` | Already built and tested in Phase 7 |
| Review count | Custom count query | `getReviewCountForRelease()` from `src/lib/community/queries.ts` | Already built |
| Owner avatars | Custom avatar component | Reuse pattern from RadarSection match cards | Consistent visual language per locked decision |
| Public route layout | New layout pattern | Copy `src/app/perfil/layout.tsx` exactly | Proven pattern for auth-optional public pages |
| Rarity badge display | New badge component | Reuse `getRarityTier()` + `getRarityBadgeVariant()` from `src/lib/collection/rarity.ts` | Already used in CollectionCard and RecordSearchCard |

**Key insight:** ~80% of this phase is wiring existing query functions and UI patterns to a new route. The only genuinely new functionality is the YouTube search server action.

## Common Pitfalls

### Pitfall 1: YouTube API Quota Exhaustion
**What goes wrong:** Default quota is 10,000 units/day. `search.list` costs 100 units per call. That's only 100 searches per day.
**Why it happens:** If many new releases are visited for the first time on the same day (e.g., after a large import), quota gets burned fast.
**How to avoid:**
1. Cache aggressively -- write `youtube_video_id` to DB on first search, never search again.
2. If YouTube API returns a quota error (HTTP 403), gracefully hide the YouTube section (don't crash the page).
3. Consider adding a `youtube_searched_at` timestamp to track when a search was attempted (even if no result found), to avoid re-searching releases with no YouTube result.
4. Rate limit the server action (use existing `apiRateLimit`).
**Warning signs:** HTTP 403 from YouTube API with `quotaExceeded` error code.

### Pitfall 2: YouTube Search Returns Wrong Video
**What goes wrong:** Searching `"{artist} {title}"` may return a different song, a remix, or a video essay about the artist.
**Why it happens:** YouTube search is fuzzy. Common artist names or generic titles produce irrelevant results.
**How to avoid:**
1. Use `type=video` and `videoCategoryId=10` (Music category) to filter results.
2. Set `maxResults=1` to get the top result only.
3. Store the result even if imperfect -- it's still better than nothing for a first pass.
4. Future: add a "wrong video? hide" button for logged-in users (out of scope for this phase).

### Pitfall 3: RLS Blocking Public Queries
**What goes wrong:** The `releases` table's SELECT policy only allows `authenticatedRole`. Supabase client queries fail for unauthenticated visitors.
**Why it happens:** Schema was designed for authenticated-only access initially.
**How to avoid:** Use Drizzle `db` client for ALL queries on the release page. It uses the service role connection, bypassing RLS entirely. This is the same pattern used by `/perfil/[username]` and `/u/[username]/bounty`.

### Pitfall 4: Missing discogsId on Entry Point Components
**What goes wrong:** Existing components (CollectionCard, RadarMatch, RecordSearchCard) don't expose `discogsId` in their data types, so you can't build the `/release/[discogsId]` link.
**Why it happens:** These components were built before the release page existed.
**How to avoid:**
- `CollectionItem` interface already includes `discogsId: number | null` -- CollectionCard just needs the link.
- `SearchResult` interface does NOT include `discogsId` -- the search query must be updated to select `releases.discogsId`.
- `RadarMatch` interface does NOT include `discogsId` -- the radar query must be updated to select `releases.discogsId`.
- For releases without a `discogsId` (manually added), link to `/release/` using the internal release UUID as fallback, or hide the link.

### Pitfall 5: YouTube iframe and CSP
**What goes wrong:** The YouTube iframe embed may be blocked by Content Security Policy headers.
**Why it happens:** Phase 11 added nonce-based CSP. The `frame-src` directive needs to allow `https://www.youtube.com`.
**How to avoid:** Check middleware CSP configuration and add `https://www.youtube.com` to `frame-src` directive if not already present.

## Code Examples

### YouTube Data API v3 Search (Server Action)
```typescript
// src/actions/release.ts
"use server";

import { createAdminClient } from "@/lib/supabase/admin";
import { db } from "@/lib/db";
import { releases } from "@/lib/db/schema/releases";
import { eq } from "drizzle-orm";
import { apiRateLimit } from "@/lib/rate-limit";
import { createClient } from "@/lib/supabase/server";

const YOUTUBE_API_KEY = process.env.YOUTUBE_API_KEY;
const YOUTUBE_SEARCH_URL = "https://www.googleapis.com/youtube/v3/search";

export async function searchYouTubeForRelease(
  releaseInternalId: string
): Promise<{ videoId: string | null; error?: string }> {
  // Rate limit (requires auth for rate limiting, but search itself is public-benefit)
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { videoId: null, error: "Authentication required to trigger search" };

  const { success } = await apiRateLimit.limit(user.id);
  if (!success) return { videoId: null, error: "Rate limited" };

  // Fetch release data
  const [release] = await db
    .select({
      id: releases.id,
      title: releases.title,
      artist: releases.artist,
      youtubeVideoId: releases.youtubeVideoId,
    })
    .from(releases)
    .where(eq(releases.id, releaseInternalId))
    .limit(1);

  if (!release) return { videoId: null, error: "Release not found" };

  // Cache hit
  if (release.youtubeVideoId) return { videoId: release.youtubeVideoId };

  // No API key configured -- skip gracefully
  if (!YOUTUBE_API_KEY) return { videoId: null };

  // Call YouTube Data API v3
  const params = new URLSearchParams({
    part: "snippet",
    q: `${release.artist} ${release.title}`,
    type: "video",
    videoCategoryId: "10", // Music
    maxResults: "1",
    key: YOUTUBE_API_KEY,
  });

  const response = await fetch(`${YOUTUBE_SEARCH_URL}?${params}`);
  if (!response.ok) return { videoId: null }; // Quota exceeded or API error -- fail gracefully

  const data = await response.json();
  const videoId = data.items?.[0]?.id?.videoId ?? null;

  // Cache result in DB (even null would need a marker, but we only write when found)
  if (videoId) {
    const admin = createAdminClient();
    await admin
      .from("releases")
      .update({ youtube_video_id: videoId, updated_at: new Date().toISOString() })
      .eq("id", release.id);
  }

  return { videoId };
}
```

### Release Page Query Functions
```typescript
// src/lib/release/queries.ts
import { eq, and, desc } from "drizzle-orm";
import { db } from "@/lib/db";
import { releases } from "@/lib/db/schema/releases";
import { collectionItems } from "@/lib/db/schema/collections";
import { profiles } from "@/lib/db/schema/users";

export async function getReleaseByDiscogsId(discogsId: number) {
  const [release] = await db
    .select()
    .from(releases)
    .where(eq(releases.discogsId, discogsId))
    .limit(1);
  return release ?? null;
}

export interface ReleaseOwner {
  userId: string;
  username: string | null;
  avatarUrl: string | null;
  displayName: string | null;
  conditionGrade: string | null;
}

export async function getOwnersByReleaseId(
  releaseId: string,
  limit = 12
): Promise<ReleaseOwner[]> {
  return db
    .select({
      userId: collectionItems.userId,
      username: profiles.username,
      avatarUrl: profiles.avatarUrl,
      displayName: profiles.displayName,
      conditionGrade: collectionItems.conditionGrade,
    })
    .from(collectionItems)
    .innerJoin(profiles, eq(collectionItems.userId, profiles.id))
    .where(eq(collectionItems.releaseId, releaseId))
    .limit(limit);
}

export async function getOwnerCountByReleaseId(releaseId: string): Promise<number> {
  const result = await db
    .select({ count: sql`count(*)::int` })
    .from(collectionItems)
    .where(eq(collectionItems.releaseId, releaseId));
  return Number(result[0]?.count ?? 0);
}
```

### YouTube Embed Component
```typescript
// Client component that renders iframe or triggers search
"use client";

interface YouTubeEmbedProps {
  videoId: string | null;
  releaseId: string; // internal UUID for search action
  isAuthenticated: boolean;
}

export function YouTubeEmbed({ videoId, releaseId, isAuthenticated }: YouTubeEmbedProps) {
  // If videoId is set, render iframe
  // If null and user is authenticated, offer to search
  // If null and not authenticated, show nothing
  // Uses youtube-nocookie.com for privacy-enhanced mode
}
```

### Entry Point Link Pattern
```typescript
// Add to CollectionCard -- item.discogsId is already in CollectionItem interface
{item.discogsId && (
  <Link
    href={`/release/${item.discogsId}`}
    className="font-mono text-[10px] text-on-surface-variant hover:text-primary transition-colors"
  >
    VIEW_RELEASE ->
  </Link>
)}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| YouTube Data API free tier 100 units/day | YouTube Data API 10,000 units/day (free) | Always been 10K | 100 searches/day is sufficient for lazy caching |
| youtube.com embed | youtube-nocookie.com embed | Privacy-enhanced mode | Better for GDPR, same functionality |
| Custom OG image generation | `generateMetadata()` with Discogs cover art URL | Next.js 13+ (App Router) | No custom OG image generation needed -- just reference the Discogs cover URL |

**Deprecated/outdated:**
- YouTube API v2 -- discontinued, must use v3
- `@next/og` package -- now built into `next/og` (no separate install needed since Next.js 14)

## Open Questions

1. **YouTube API Key provisioning**
   - What we know: YouTube Data API v3 requires a Google Cloud API key with YouTube Data API v3 enabled. 10,000 units/day free.
   - What's unclear: Whether the developer already has a Google Cloud project and API key set up.
   - Recommendation: Plan includes a Wave 0 task to set up `YOUTUBE_API_KEY` env var. If not configured, the YouTube section silently degrades (no embed shown). The page works fully without it.

2. **Releases without discogsId**
   - What we know: Some releases were added manually or via YouTube wantlist (they have `youtube_video_id` but no `discogs_id`). The route is `/release/[discogsId]`, which won't work for these.
   - What's unclear: How many such releases exist and whether they need their own pages.
   - Recommendation: Phase 12 only serves releases with a `discogsId`. Non-Discogs releases don't get a release page in this phase. Entry point links only render when `discogsId` is non-null.

3. **CSP frame-src for YouTube**
   - What we know: Phase 11 added nonce-based CSP via middleware.
   - What's unclear: Whether `frame-src` currently includes `https://www.youtube.com` or `https://www.youtube-nocookie.com`.
   - Recommendation: Check middleware CSP config in Wave 0. Add YouTube domains to frame-src if missing.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest 3.x |
| Config file | `vitest.config.ts` |
| Quick run command | `npx vitest run --reporter=verbose` |
| Full suite command | `npx vitest run --reporter=verbose` |

### Phase Requirements -> Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| REL-01 | /release/[discogsId] loads without auth, returns release data | unit | `npx vitest run tests/unit/release/release-page.test.ts -x` | Wave 0 |
| REL-02 | Discogs link constructed from discogsId | unit | `npx vitest run tests/unit/release/release-queries.test.ts -x` | Wave 0 |
| REL-03 | YouTube search caches result, handles quota errors gracefully | unit | `npx vitest run tests/unit/release/youtube-search.test.ts -x` | Wave 0 |
| REL-04 | Owners list returns correct users for a release | unit | `npx vitest run tests/unit/release/owners-query.test.ts -x` | Wave 0 |
| REL-05 | Reviews shown for release (reuses existing query) | unit | `npx vitest run tests/unit/release/release-reviews.test.ts -x` | Wave 0 |

### Sampling Rate
- **Per task commit:** `npx vitest run tests/unit/release/ --reporter=verbose`
- **Per wave merge:** `npx vitest run --reporter=verbose`
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps
- [ ] `tests/unit/release/release-queries.test.ts` -- covers REL-01, REL-02, REL-04
- [ ] `tests/unit/release/youtube-search.test.ts` -- covers REL-03
- [ ] `tests/unit/release/release-reviews.test.ts` -- covers REL-05

*(No framework install needed -- Vitest already configured)*

## Existing Infrastructure Analysis

### Schema: releases table
The `releases` table already has everything needed:
- `id` (UUID, PK) -- internal identifier
- `discogs_id` (integer, unique) -- URL parameter for the public route
- `youtube_video_id` (varchar(20), unique) -- YouTube cache column, **already exists**
- `title`, `artist`, `year`, `genre`, `style`, `country`, `format`, `label` -- display metadata
- `cover_image_url` -- for OG image and page hero
- `discogs_have`, `discogs_want`, `rarity_score` -- for rarity display

**No schema migration needed.** All columns are in place.

### Schema: reviews table
- Keyed on `(userId, releaseId)` with unique constraint
- `releaseId` references `releases.id` -- we look up reviews by the internal release UUID
- `getReviewsForRelease(releaseId)` already implemented with cursor pagination

### Schema: collection_items table
- `releaseId` references `releases.id` -- join to find owners
- `userId` references the owning user
- `conditionGrade` available for display

### Existing Query Functions (reusable)
| Function | Location | Purpose |
|----------|----------|---------|
| `getReviewsForRelease(releaseId, cursor?, limit?)` | `src/lib/community/queries.ts` | Paginated reviews for a release |
| `getReviewCountForRelease(releaseId)` | `src/lib/community/queries.ts` | Review count |
| `getRarityTier(score)` | `src/lib/collection/rarity.ts` | Rarity badge text |
| `getRarityBadgeVariant(tier)` | `src/lib/collection/rarity.ts` | Badge styling variant |

### Entry Point Components Needing Links
| Component | File | Data Available | Change Needed |
|-----------|------|----------------|---------------|
| `CollectionCard` | `src/app/(protected)/(profile)/perfil/_components/collection-card.tsx` | `item.discogsId` via `CollectionItem` interface | Add VIEW_RELEASE link when `discogsId` is non-null |
| `RadarSection` match cards | `src/app/(protected)/(feed)/feed/_components/radar-section.tsx` | `match.releaseId` (internal UUID) but NOT `match.discogsId` | Add `discogsId` to `RadarMatch` interface and query |
| `RecordSearchCard` | `src/app/(protected)/(explore)/explorar/_components/record-search-card.tsx` | `release.id` (internal UUID) but NOT `release.discogsId` | Add `discogsId` to `SearchResult` interface and query |

### Image Config
`next.config.ts` already includes:
- `i.discogs.com` -- Discogs cover images
- `st.discogs.com` -- Discogs static images
- `i.ytimg.com` -- YouTube thumbnails

No configuration changes needed.

## Sources

### Primary (HIGH confidence)
- `src/lib/db/schema/releases.ts` -- `youtubeVideoId` column already exists
- `src/lib/db/schema/reviews.ts` -- review schema with `releaseId` FK
- `src/lib/db/schema/collections.ts` -- collection items with `releaseId` FK
- `src/app/perfil/layout.tsx` -- public route layout pattern (auth-optional)
- `src/app/perfil/[username]/page.tsx` -- public profile page pattern
- `src/app/u/[username]/bounty/page.tsx` -- `generateMetadata()` pattern
- `src/lib/community/queries.ts` -- `getReviewsForRelease()`, `getReviewCountForRelease()`
- `src/lib/collection/queries.ts` -- `CollectionItem` interface with `discogsId`
- `src/lib/discovery/queries.ts` -- `SearchResult` interface (missing `discogsId`)
- `src/lib/wantlist/radar-queries.ts` -- `RadarMatch` interface (missing `discogsId`)
- `next.config.ts` -- image remote patterns already configured

### Secondary (MEDIUM confidence)
- [YouTube Data API v3 Quota Calculator](https://developers.google.com/youtube/v3/determine_quota_cost) -- search.list costs 100 units
- [YouTube Data API v3 search.list docs](https://developers.google.com/youtube/v3/docs/search/list) -- endpoint specification
- [Next.js generateMetadata docs](https://nextjs.org/docs/app/api-reference/functions/generate-metadata) -- metadata generation for dynamic routes
- [YouTube Embedded Players docs](https://developers.google.com/youtube/player_parameters) -- iframe embed parameters

### Tertiary (LOW confidence)
- None -- all findings verified with primary or secondary sources

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - No new dependencies, everything already in the project
- Architecture: HIGH - Exact patterns exist in codebase (public profile, bounty page, review queries)
- Pitfalls: HIGH - RLS, quota, and CSP issues identified from direct code inspection
- YouTube API integration: MEDIUM - API itself is well-documented but quota management needs monitoring in production

**Research date:** 2026-03-29
**Valid until:** 2026-04-28 (stable -- YouTube API v3 and Next.js 15 are not changing)
