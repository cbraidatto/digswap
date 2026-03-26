# Phase 5: Social Layer - Research

**Researched:** 2026-03-26
**Domain:** Social graph, activity feed, collection comparison, public profiles, infinite scroll
**Confidence:** HIGH

## Summary

Phase 5 builds the social layer on top of existing infrastructure. The database schema (`follows`, `activity_feed` tables) and profile system (`profiles.username`) already exist from Phase 1. The collection components (`CollectionGrid`, `FilterBar`, `Pagination`, `CollectionCard`) are reusable from Phase 4. This phase is primarily a UI + server action wiring effort, not an infrastructure build.

The main technical challenges are: (1) cursor-based infinite scroll for the feed using a client component wrapper around server-fetched data, (2) optimistic UI for follow/unfollow using React 19's `useOptimistic` hook, (3) collection comparison queries using Drizzle ORM set operations or dual-query approach, and (4) weaving `logActivity` calls into existing server actions without disrupting them.

**Primary recommendation:** Build server actions + query functions first (follow, unfollow, feed queries, comparison queries, search), then wire UI components that consume them. Reuse Phase 4 components for public profiles by parameterizing the `userId`. Use `react-intersection-observer` for infinite scroll with a client wrapper component that calls a server action to fetch next pages.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- D-01: Feed modes: global (popularity-ranked) before following; personal (chronological) after following. Plus a "global" toggle.
- D-02: Infinite scroll with cursor-based pagination using `createdAt` timestamp.
- D-03: Phase 5 events: `added_record` and `followed_user` only.
- D-04: Feed card layout for `added_record`: rarity accent strip, avatar+username+timestamp, cover art+metadata grid, rarity score badge.
- D-05: Feed card for `followed_user`: compact inline line with links to both profiles.
- D-06: Feed header subtitle changes with mode: global vs personal.
- D-07: Public profile route: `/perfil/[username]`.
- D-08: Public profile shows full collection, condition grades, filter bar, follower/following counts. No personal notes or Discogs credentials.
- D-09: Public profile header: avatar, display name, username, bio, follower/following counts, Follow/Unfollow button, Compare Collection button.
- D-10: Reuse CollectionGrid + FilterBar + Pagination components for public profiles.
- D-11: Follow action via server action, optimistic UI.
- D-12: Unfollow via server action delete.
- D-13: Following/followers on own profile as counters with expandable inline list.
- D-14: Following/followers on public profile, same counters and expand behavior.
- D-15: Discovery via feed username links + explorar search.
- D-16: Explorar page gains username search input.
- D-17: Compare Collection button navigates to `/perfil/[username]/compare`.
- D-18: 3-column comparison layout: unique-to-you / in-common / unique-to-them.
- D-19: Match on `discogs_release_id` (exact), fallback to normalized `artist+title`. No fuzzy matching.
- D-20: Ghost Protocol aesthetic for comparison page.
- D-21: Progress bar as banner at top of /feed, auto-dismisses on completion.
- D-22: 3 steps: Connect Discogs, Follow 3 diggers, Join a group (locked for Phase 7).
- D-23: Steps are clickable links (Step 1 -> /settings, Step 2 -> /explorar, Step 3 -> greyed).
- D-24: Progress bar state computed server-side on each feed load.
- D-25: Server actions: followUser, unfollowUser, logActivity.
- D-26: logActivity called inside addRecord/importComplete and followUser.
- D-27: Global feed query: ORDER BY rarity DESC + recency tiebreaker.
- D-28: Personal feed query: WHERE user_id IN (SELECT following_id FROM follows WHERE follower_id = $currentUser) ORDER BY created_at DESC.

### Claude's Discretion
- Exact global feed popularity formula (keep simple: rarity from releases table, no interaction count yet).
- Architectural details of how components are split/organized within the constraints above.

### Deferred Ideas (OUT OF SCOPE)
- Real-time feed updates via Supabase Realtime (Phase 6).
- Feed likes/comments/reactions (Phase 7).
- "Join a group" progress bar step completion (Phase 7).
- Wantlist matching (Phase 6).
- Algorithm sophistication / collaborative filtering (post-MVP).
- Block/mute users (no moderation scope in v1).
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| SOCL-01 | User can follow other diggers | Server action `followUser` inserting into `follows` table with optimistic UI via `useOptimistic`. RLS policy `follows_insert_own` already exists. |
| SOCL-02 | User can unfollow diggers | Server action `unfollowUser` deleting from `follows` table. RLS policy `follows_delete_own` already exists. Optimistic UI revert pattern. |
| SOCL-03 | User can view activity feed showing followed diggers' actions | Cursor-based pagination query on `activity_feed` joined with `releases` for rarity data. Two modes: global (rarity-ranked) and personal (chronological from followed). Infinite scroll via `react-intersection-observer`. |
| SOCL-04 | User can compare collections (overlap, unique-to-me, unique-to-them) | Three queries using Drizzle: two `except` operations for unique records + one `intersect` for overlap, or a dual-query approach with JS-side set operations on `discogs_id`/`release_id`. |
| SOCL-05 | User can view any public profile and their collection | Dynamic route `/perfil/[username]`, reuses `CollectionGrid`, `FilterBar`, `Pagination` from Phase 4. Server-side profile lookup by username, collection query by user ID. |
</phase_requirements>

## Project Constraints (from CLAUDE.md)

- **Solo developer** -- favor simplicity over premature optimization
- **Next.js 15.5.14** with React 19.1.0, App Router, Server Actions
- **Drizzle ORM 0.45.1** with `prepare: false` for Supabase PgBouncer
- **Supabase Auth** with `getUser()` for JWT validation in all server code
- **Tailwind CSS v4** with Ghost Protocol theme (OKLCH dark-warm palette)
- **shadcn/ui** for component library, Tailwind-first
- **Zustand 5.0.12** for client-side state only (not server data)
- **Biome** for linting/formatting (not ESLint)
- **Vitest** for unit/integration tests, **Playwright** for E2E
- **Admin client** pattern (not Drizzle) used in server actions that need RLS bypass
- **Server actions** live in `src/actions/` directory
- Collection queries use **Drizzle `db` client** with `innerJoin`, not Supabase client

## Standard Stack

### Core (already installed)
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Next.js | 15.5.14 | Framework | Already installed. Server Actions, App Router, dynamic routes for `/perfil/[username]` |
| React | 19.1.0 | UI library | Already installed. Provides `useOptimistic` hook for follow/unfollow |
| Drizzle ORM | 0.45.1 | Database queries | Already installed. Used for all feed, follow, comparison queries |
| Zustand | 5.0.12 | Client state | Already installed. Not needed for this phase (server data managed via server components) |
| @supabase/ssr | 0.9.0 | Auth | Already installed. `createClient()` for auth checks in server actions |
| zod | 4.3.6 | Validation | Already installed. Input validation for server actions |

### New Dependency
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| react-intersection-observer | 10.0.3 | Infinite scroll trigger | Provides `useInView` hook to detect when the sentinel element enters viewport, triggering next page load |

**Installation:**
```bash
npm install react-intersection-observer
```

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| react-intersection-observer | Raw Intersection Observer API | More boilerplate, no React integration, error-prone cleanup. The library is 1.8KB gzipped -- trivial cost. |
| react-intersection-observer | TanStack Query infinite scroll | TanStack Query is not installed. Adding it for one feature adds unnecessary complexity. Server actions + useInView is simpler. |
| Cursor-based pagination | Offset pagination (existing Pagination component) | Offset pagination has duplicate/skip issues on active feeds. Cursor pagination is correct for chronological feeds. Keep offset pagination for collection grids (where data is stable). |

## Architecture Patterns

### Recommended Project Structure
```
src/
  actions/
    social.ts               # followUser, unfollowUser server actions
    collection.ts            # MODIFIED: add logActivity call to addRecordToCollection
  lib/
    social/
      queries.ts             # getPersonalFeed, getGlobalFeed, getFollowCounts, getFollowers, getFollowing
      comparison.ts          # getCollectionComparison (3 sets)
    collection/
      queries.ts             # EXISTING: reused for public profiles (already parameterized by userId)
  app/(protected)/
    (feed)/feed/
      page.tsx               # Server Component: fetch initial feed + progress bar state
      _components/
        feed-container.tsx    # Client Component: manages infinite scroll + feed mode toggle
        feed-card.tsx         # Client Component: renders added_record card (Ghost Protocol style)
        follow-card.tsx       # Client Component: renders followed_user inline card
        progress-banner.tsx   # Server or Client Component: 3-step onboarding progress bar
    (profile)/perfil/
      page.tsx                # MODIFIED: add follower/following counts + expandable list
      [username]/
        page.tsx              # Server Component: public profile with collection
        _components/
          follow-button.tsx   # Client Component: optimistic follow/unfollow
          profile-header.tsx  # Server Component: avatar, bio, counts, buttons
        compare/
          page.tsx            # Server Component: 3-column comparison layout
    (explore)/explorar/
      page.tsx                # MODIFIED: add username search input + results
```

### Pattern 1: Infinite Scroll with Server Actions
**What:** A Client Component wrapper that holds accumulated items, uses `useInView` to detect scroll position, and calls a server action to fetch the next page.
**When to use:** Activity feed pages where data loads incrementally.
**Example:**
```typescript
// Source: Drizzle docs (cursor-based pagination) + react-intersection-observer
// Server action in actions/social.ts
"use server";
import { db } from "@/lib/db";
import { activityFeed } from "@/lib/db/schema/social";
import { lt, desc, and, inArray } from "drizzle-orm";

export async function loadMoreFeed(
  cursor: string | null, // ISO timestamp string
  mode: "personal" | "global",
) {
  // ... auth check ...
  const PAGE_SIZE = 20;
  const cursorDate = cursor ? new Date(cursor) : null;

  if (mode === "personal") {
    // D-28: personal feed from followed diggers
    const items = await db
      .select({ /* ... */ })
      .from(activityFeed)
      .innerJoin(/* releases for metadata */)
      .where(
        and(
          inArray(activityFeed.userId, /* subquery: following_ids */),
          cursorDate ? lt(activityFeed.createdAt, cursorDate) : undefined,
        )
      )
      .orderBy(desc(activityFeed.createdAt))
      .limit(PAGE_SIZE);
    return items;
  }
  // global feed: ORDER BY rarity DESC, createdAt DESC
}

// Client Component
"use client";
import { useInView } from "react-intersection-observer";
import { useState, useEffect, useTransition } from "react";
import { loadMoreFeed } from "@/actions/social";

function FeedContainer({ initialItems, mode }) {
  const [items, setItems] = useState(initialItems);
  const [cursor, setCursor] = useState(/* last item createdAt */);
  const [hasMore, setHasMore] = useState(true);
  const [isPending, startTransition] = useTransition();
  const { ref, inView } = useInView({ threshold: 0 });

  useEffect(() => {
    if (inView && hasMore && !isPending) {
      startTransition(async () => {
        const newItems = await loadMoreFeed(cursor, mode);
        if (newItems.length === 0) setHasMore(false);
        else {
          setItems(prev => [...prev, ...newItems]);
          setCursor(newItems[newItems.length - 1].createdAt);
        }
      });
    }
  }, [inView, hasMore, isPending]);

  return (
    <>
      {items.map(item => <FeedCard key={item.id} item={item} />)}
      {hasMore && <div ref={ref} className="h-10" />}
      {isPending && <LoadingSpinner />}
    </>
  );
}
```

### Pattern 2: Optimistic Follow/Unfollow with useOptimistic
**What:** React 19's `useOptimistic` hook provides instant UI feedback for follow/unfollow actions with automatic revert on error.
**When to use:** Follow button on public profiles and any follow-related UI.
**Example:**
```typescript
// Source: react.dev/reference/react/useOptimistic
"use client";
import { useOptimistic, startTransition } from "react";
import { followUser, unfollowUser } from "@/actions/social";

interface FollowState {
  isFollowing: boolean;
  followerCount: number;
}

export function FollowButton({
  targetUserId,
  initialIsFollowing,
  initialFollowerCount,
}: {
  targetUserId: string;
  initialIsFollowing: boolean;
  initialFollowerCount: number;
}) {
  const [optimistic, setOptimistic] = useOptimistic(
    { isFollowing: initialIsFollowing, followerCount: initialFollowerCount },
    (current: FollowState, action: "follow" | "unfollow") => ({
      isFollowing: action === "follow",
      followerCount: current.followerCount + (action === "follow" ? 1 : -1),
    }),
  );

  function handleToggle() {
    startTransition(async () => {
      if (optimistic.isFollowing) {
        setOptimistic("unfollow");
        await unfollowUser(targetUserId);
      } else {
        setOptimistic("follow");
        await followUser(targetUserId);
      }
    });
  }

  return (
    <button onClick={handleToggle}>
      {optimistic.isFollowing ? "Unfollow" : "Follow"}
      <span>{optimistic.followerCount}</span>
    </button>
  );
}
```

### Pattern 3: Public Profile with Reused Collection Components
**What:** The `/perfil/[username]` route fetches a different user's profile + collection and renders identical collection UI components.
**When to use:** Public profile pages.
**Example:**
```typescript
// Source: Next.js 15 dynamic routes (async params)
// src/app/(protected)/(profile)/perfil/[username]/page.tsx

interface PublicProfileProps {
  params: Promise<{ username: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export default async function PublicProfilePage({ params, searchParams }: PublicProfileProps) {
  const { username } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/signin");

  // Lookup target user by username
  const [targetProfile] = await db
    .select()
    .from(profiles)
    .where(eq(profiles.username, username))
    .limit(1);

  if (!targetProfile) notFound();

  // Check if current user is viewing their own profile
  const isOwner = user.id === targetProfile.id;
  if (isOwner) redirect("/perfil");

  // Reuse existing collection queries
  const filters = collectionFilterSchema.parse(await searchParams);
  const [items, totalCount, genres, formats, followCounts, isFollowing] = await Promise.all([
    getCollectionPage(targetProfile.id, filters),
    getCollectionCount(targetProfile.id, filters),
    getUniqueGenres(targetProfile.id),
    getUniqueFormats(targetProfile.id),
    getFollowCounts(targetProfile.id),
    checkIsFollowing(user.id, targetProfile.id),
  ]);

  // Render with same CollectionGrid, FilterBar, Pagination
  // but isOwner=false (hides ConditionEditor, shows Follow button)
}
```

### Pattern 4: Collection Comparison via Dual-Query + JS Set Operations
**What:** Fetch both users' collection release IDs, then compute set differences and intersection in JavaScript.
**When to use:** `/perfil/[username]/compare` page.
**Why not SQL set operations:** Drizzle's `intersect`/`except` require identical column shapes. The comparison needs to also return metadata (title, artist, rarity). A dual-query approach is simpler and more flexible:
```typescript
// Fetch both users' release IDs
const myReleaseIds = new Set(
  (await db.select({ releaseId: collectionItems.releaseId, discogsId: releases.discogsId, ... })
    .from(collectionItems)
    .innerJoin(releases, eq(collectionItems.releaseId, releases.id))
    .where(eq(collectionItems.userId, currentUserId))
  ).map(r => r.releaseId)
);

const theirReleaseIds = new Set(theirItems.map(r => r.releaseId));

// Set operations
const uniqueToMe = myItems.filter(r => !theirReleaseIds.has(r.releaseId));
const inCommon = myItems.filter(r => theirReleaseIds.has(r.releaseId));
const uniqueToThem = theirItems.filter(r => !myReleaseIds.has(r.releaseId));
```

**D-19 fallback matching:** For items without `discogsId`, normalize `artist+title` to lowercase and compare as secondary key.

### Anti-Patterns to Avoid
- **Do NOT use Supabase client for data queries:** The project uses Drizzle `db` for all data queries (per Phase 4 decision). Supabase client is only for auth operations.
- **Do NOT add TanStack Query for the feed:** The project does not have TanStack Query installed. Use server actions + `useState` for feed state. Adding a dependency for one use case is premature.
- **Do NOT use offset pagination for the feed:** Offset pagination (existing `Pagination` component) is fine for collection grids (stable data), but feeds are chronological and actively receiving new entries. Cursor-based is mandatory per D-02.
- **Do NOT create separate API routes for feed data:** Use server actions directly from client components. This is the established project pattern (see `updateConditionGrade`, `addRecordToCollection`).
- **Do NOT use `revalidatePath` after follow/unfollow:** The project does not use Next.js caching/revalidation currently. Optimistic UI + page-level server component rendering on navigation is sufficient.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Intersection Observer | Custom scroll listeners, `onScroll` event handlers | `react-intersection-observer` (useInView) | Correct threshold handling, cleanup, React lifecycle integration. 1.8KB gzipped. |
| Optimistic UI state | Manual pending/error state tracking with useState | React 19 `useOptimistic` hook | Automatic revert on error, works with startTransition, zero dependencies |
| Cursor pagination logic | Custom cursor encoding/decoding | Direct `createdAt` timestamp comparison with Drizzle `lt()` | Timestamps are already unique enough with UUID tiebreaker. ISO string is the cursor. |
| Username search | Full-text search with tsvector | PostgreSQL `ILIKE` via Drizzle `ilike()` | Username search is prefix-matching on a short string column. ILIKE with `%pattern%` is sufficient. Full-text search is overkill for usernames. |

**Key insight:** This phase is a wiring phase. All infrastructure exists (schema, auth, collection components). The risk is over-engineering the glue code. Keep server actions thin, reuse existing query patterns, and let React 19 handle optimistic state.

## Common Pitfalls

### Pitfall 1: Next.js 15 Async Params
**What goes wrong:** Accessing `params.username` directly instead of `const { username } = await params` causes a runtime error in Next.js 15.
**Why it happens:** Next.js 15 changed dynamic route params to be async (Promise-based) for streaming optimization.
**How to avoid:** Always `await params` before accessing properties. The type signature is `params: Promise<{ username: string }>`.
**Warning signs:** TypeScript error about `Property 'username' does not exist on type 'Promise<...>'`.

### Pitfall 2: Drizzle `prepare: false` with Supabase PgBouncer
**What goes wrong:** Prepared statements fail silently or throw errors when using Supabase's connection pooler (PgBouncer in transaction mode).
**Why it happens:** PgBouncer in transaction mode does not support prepared statements. The project already has `prepare: false` in `src/lib/db/index.ts`.
**How to avoid:** All new queries use the existing `db` client which has `prepare: false` configured. Do not create new Drizzle connections.
**Warning signs:** Intermittent query failures in production/preview environments.

### Pitfall 3: Self-Follow Prevention
**What goes wrong:** User follows themselves, creating a nonsensical social graph entry.
**Why it happens:** No client-side or server-side guard.
**How to avoid:** Server action `followUser` must check `targetUserId !== currentUserId`. Client hides Follow button on own profile (D-09). Both layers must guard.
**Warning signs:** Users appearing in their own following list.

### Pitfall 4: Feed Infinite Scroll Duplicate Items
**What goes wrong:** New activity entries created between page loads cause items to shift, producing duplicates in the accumulated feed.
**Why it happens:** Offset-based pagination would skip/duplicate on inserts. Even cursor-based can show duplicates if the cursor comparison is not strict.
**How to avoid:** Use `lt(activityFeed.createdAt, cursorDate)` (strict less-than). For same-millisecond entries, add secondary sort on `activityFeed.id` (UUID). Deduplicate in the client accumulator using `id` as key.
**Warning signs:** Same feed card appearing twice when scrolling.

### Pitfall 5: Large Collection Comparison Memory
**What goes wrong:** Comparing two large collections (5000+ records each) fetches all records into memory.
**Why it happens:** Set operations require full datasets for comparison.
**How to avoid:** For Phase 5, this is acceptable -- collections are typically 200-2000 records, and we only fetch `releaseId + discogsId + title + artist + rarityScore` (lightweight rows). If performance becomes an issue, move to SQL-level set operations or paginate comparison results. Add a limit safeguard (e.g., max 5000 records per side).
**Warning signs:** Slow page loads on the compare route for power users.

### Pitfall 6: Activity Feed Insert vs. Admin Client
**What goes wrong:** Inserting into `activity_feed` using the regular Supabase client respects RLS (`userId = auth.uid()`), which is correct. But if `logActivity` is called inside a server action that already uses the admin client (like `addRecordToCollection`), mixing clients can cause confusion.
**Why it happens:** The existing `addRecordToCollection` uses `createAdminClient()` for writes. Adding a `logActivity` call there must use the same pattern for consistency.
**How to avoid:** `logActivity` should accept a `userId` parameter and use the admin client for the insert. Alternatively, use Drizzle `db` directly since the `activity_feed_insert_own` RLS policy allows inserts where `userId = auth.uid()` -- but the server action context may not have the Supabase auth context when called within another server action.
**Warning signs:** RLS violation errors on activity_feed inserts.

### Pitfall 7: Username Case Sensitivity in Routes
**What goes wrong:** Username "WaxProphet" and "waxprophet" resolve to different routes but the same profile.
**Why it happens:** URLs are case-sensitive by default.
**How to avoid:** Store usernames in lowercase (or enforce lowercase on creation). In the `[username]` route, normalize: `const normalizedUsername = username.toLowerCase()`. Query with case-insensitive comparison: `ilike(profiles.username, normalizedUsername)` or `eq(profiles.username, normalizedUsername)` if stored lowercase.
**Warning signs:** 404 errors when accessing profiles with different casing.

## Code Examples

Verified patterns from the existing codebase and official sources:

### Drizzle Cursor-Based Feed Query
```typescript
// Source: https://orm.drizzle.team/docs/guides/cursor-based-pagination
import { db } from "@/lib/db";
import { activityFeed } from "@/lib/db/schema/social";
import { releases } from "@/lib/db/schema/releases";
import { collectionItems } from "@/lib/db/schema/collections";
import { profiles } from "@/lib/db/schema/users";
import { follows } from "@/lib/db/schema/social";
import { desc, lt, and, eq, inArray, sql } from "drizzle-orm";

const FEED_PAGE_SIZE = 20;

// Personal feed (D-28): chronological from followed diggers
export async function getPersonalFeed(userId: string, cursor: Date | null) {
  // Subquery for followed user IDs
  const followedIds = db
    .select({ id: follows.followingId })
    .from(follows)
    .where(eq(follows.followerId, userId));

  return db
    .select({
      id: activityFeed.id,
      userId: activityFeed.userId,
      actionType: activityFeed.actionType,
      targetType: activityFeed.targetType,
      targetId: activityFeed.targetId,
      metadata: activityFeed.metadata,
      createdAt: activityFeed.createdAt,
      // Join profile for display name + username
      displayName: profiles.displayName,
      username: profiles.username,
      avatarUrl: profiles.avatarUrl,
    })
    .from(activityFeed)
    .innerJoin(profiles, eq(activityFeed.userId, profiles.id))
    .where(
      and(
        inArray(activityFeed.userId, followedIds),
        cursor ? lt(activityFeed.createdAt, cursor) : undefined,
      ),
    )
    .orderBy(desc(activityFeed.createdAt))
    .limit(FEED_PAGE_SIZE);
}

// Global feed (D-27): ranked by rarity + recency tiebreaker
// Only for added_record events (the primary content)
export async function getGlobalFeed(cursor: { score: number; createdAt: Date } | null) {
  // Global feed shows added_record events ranked by rarity
  return db
    .select({
      id: activityFeed.id,
      userId: activityFeed.userId,
      actionType: activityFeed.actionType,
      targetId: activityFeed.targetId,
      metadata: activityFeed.metadata,
      createdAt: activityFeed.createdAt,
      displayName: profiles.displayName,
      username: profiles.username,
      avatarUrl: profiles.avatarUrl,
      // Release data for rarity
      releaseTitle: releases.title,
      releaseArtist: releases.artist,
      rarityScore: releases.rarityScore,
      coverImageUrl: releases.coverImageUrl,
    })
    .from(activityFeed)
    .innerJoin(profiles, eq(activityFeed.userId, profiles.id))
    .innerJoin(releases, eq(activityFeed.targetId, releases.id))
    .where(
      and(
        eq(activityFeed.actionType, "added_record"),
        eq(activityFeed.targetType, "release"),
        // Cursor: items with lower rarity, or same rarity but older
        cursor
          ? sql`(COALESCE(${releases.rarityScore}, 0) < ${cursor.score}
                 OR (COALESCE(${releases.rarityScore}, 0) = ${cursor.score}
                     AND ${activityFeed.createdAt} < ${cursor.createdAt.toISOString()}))`
          : undefined,
      ),
    )
    .orderBy(desc(sql`COALESCE(${releases.rarityScore}, 0)`), desc(activityFeed.createdAt))
    .limit(FEED_PAGE_SIZE);
}
```

### Drizzle ILIKE Username Search
```typescript
// Source: https://orm.drizzle.team/docs/select (ilike operator)
import { ilike } from "drizzle-orm";

export async function searchUsers(query: string) {
  const trimmed = query.trim().toLowerCase();
  if (!trimmed || trimmed.length < 2) return [];

  return db
    .select({
      id: profiles.id,
      username: profiles.username,
      displayName: profiles.displayName,
      avatarUrl: profiles.avatarUrl,
    })
    .from(profiles)
    .where(ilike(profiles.username, `%${trimmed}%`))
    .limit(20);
}
```

### Follow Count Queries
```typescript
// Source: Drizzle ORM count aggregate
import { count, eq } from "drizzle-orm";

export async function getFollowCounts(userId: string) {
  const [[followers], [following]] = await Promise.all([
    db.select({ count: count() }).from(follows).where(eq(follows.followingId, userId)),
    db.select({ count: count() }).from(follows).where(eq(follows.followerId, userId)),
  ]);

  return {
    followers: followers?.count ?? 0,
    following: following?.count ?? 0,
  };
}

export async function checkIsFollowing(currentUserId: string, targetUserId: string) {
  const [row] = await db
    .select({ id: follows.id })
    .from(follows)
    .where(and(eq(follows.followerId, currentUserId), eq(follows.followingId, targetUserId)))
    .limit(1);

  return !!row;
}
```

### Server Action Pattern (follows existing addRecordToCollection pattern)
```typescript
// Source: Existing codebase pattern from src/actions/collection.ts
"use server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { revalidatePath } from "next/cache";

export async function followUser(
  targetUserId: string,
): Promise<{ success?: boolean; error?: string }> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");
  if (user.id === targetUserId) return { error: "Cannot follow yourself" };

  const admin = createAdminClient();

  // Check not already following
  const { data: existing } = await admin
    .from("follows")
    .select("id")
    .eq("follower_id", user.id)
    .eq("following_id", targetUserId)
    .maybeSingle();

  if (existing) return { error: "Already following" };

  const { error } = await admin
    .from("follows")
    .insert({
      follower_id: user.id,
      following_id: targetUserId,
    });

  if (error) return { error: "Could not follow user" };

  // Log activity
  await admin.from("activity_feed").insert({
    user_id: user.id,
    action_type: "followed_user",
    target_type: "user",
    target_id: targetUserId,
    metadata: {},
  });

  return { success: true };
}
```

### Progress Bar Server-Side State Computation
```typescript
// Source: D-22, D-24 from CONTEXT.md
import { count, eq } from "drizzle-orm";

interface ProgressState {
  discogsConnected: boolean;
  followCount: number;
  allComplete: boolean;
}

export async function getProgressState(userId: string): Promise<ProgressState> {
  const [[profile], [followResult]] = await Promise.all([
    db.select({ discogsConnected: profiles.discogsConnected }).from(profiles).where(eq(profiles.id, userId)).limit(1),
    db.select({ count: count() }).from(follows).where(eq(follows.followerId, userId)),
  ]);

  const discogsConnected = profile?.discogsConnected ?? false;
  const followCount = followResult?.count ?? 0;

  return {
    discogsConnected,
    followCount,
    // Step 3 (join group) is locked in Phase 5 -- never complete
    allComplete: false,
  };
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| useOptimistic experimental | useOptimistic stable in React 19 | React 19 (Dec 2024) | No experimental flag needed. This project uses React 19.1.0 -- fully supported. |
| Next.js sync params | Next.js 15 async params (`await params`) | Next.js 15 (Oct 2024) | Must await params in all dynamic route pages. TypeScript enforces this. |
| Offset pagination for feeds | Cursor-based pagination | Industry standard | Cursor avoids duplicate/skip issues on active feeds. Use ISO timestamp as cursor. |
| SWR/React Query for client fetch | Server Actions + useState | Next.js 14-15 App Router pattern | Server actions provide the same fetch capability without adding a client-side library dependency. |

**Deprecated/outdated:**
- `@supabase/auth-helpers-nextjs`: Replaced by `@supabase/ssr` (already used in this project)
- `getSession()`: Use `getUser()` for JWT validation (already enforced in this project)

## Open Questions

1. **Global feed cursor for rarity-ranked items**
   - What we know: Global feed is sorted by rarity DESC + createdAt DESC. Cursor pagination on a non-unique sort column (rarity_score) requires composite cursor (score + timestamp).
   - What's unclear: Whether the composite cursor approach is worth the complexity for global feed given that users will rarely paginate deep into it.
   - Recommendation: Implement composite cursor (rarity_score + createdAt). If too complex during implementation, fall back to simple offset pagination for the global feed only (acceptable since global feed is curated/ranked, not chronological).

2. **logActivity inside import worker**
   - What we know: D-26 says `logActivity` should be called inside `addRecord`/`importComplete`. The bulk import worker (`src/lib/discogs/import-worker.ts`) adds many records at once.
   - What's unclear: Should each imported record generate an `added_record` activity entry? A 5000-record import would create 5000 feed entries, flooding the global feed.
   - Recommendation: For Discogs imports, log a single `imported_collection` event (or skip activity logging entirely for bulk imports). Only log `added_record` for manual single-record additions via the Add Record dialog. This keeps the feed meaningful.

3. **Collection comparison for users without Discogs IDs**
   - What we know: D-19 specifies match on `discogs_release_id`, fallback to normalized `artist+title`.
   - What's unclear: How to normalize artist+title reliably (e.g., "Miles Davis" vs "Davis, Miles", featuring artists).
   - Recommendation: Simple normalization: `lowercase(trim(artist)) + '||' + lowercase(trim(title))`. Do not attempt fuzzy matching -- D-19 explicitly says "exact match only for Phase 5."

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest 3.x (jsdom environment) |
| Config file | `vitest.config.ts` (exists) |
| Quick run command | `npx vitest run tests/integration/social/ --reporter=verbose` |
| Full suite command | `npx vitest run` |

### Phase Requirements -> Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| SOCL-01 | Follow a digger, appears in following list | integration | `npx vitest run tests/integration/social/follow.test.ts -x` | Wave 0 |
| SOCL-01 | followUser server action inserts into follows, logs activity | integration | `npx vitest run tests/integration/social/follow.test.ts -x` | Wave 0 |
| SOCL-01 | Self-follow prevention | integration | `npx vitest run tests/integration/social/follow.test.ts -x` | Wave 0 |
| SOCL-02 | Unfollow a digger, removed from following list | integration | `npx vitest run tests/integration/social/unfollow.test.ts -x` | Wave 0 |
| SOCL-02 | unfollowUser server action deletes from follows | integration | `npx vitest run tests/integration/social/unfollow.test.ts -x` | Wave 0 |
| SOCL-03 | Personal feed returns items from followed users, chronological | integration | `npx vitest run tests/integration/social/feed.test.ts -x` | Wave 0 |
| SOCL-03 | Global feed returns items ranked by rarity | integration | `npx vitest run tests/integration/social/feed.test.ts -x` | Wave 0 |
| SOCL-03 | Cursor-based pagination returns correct next page | unit | `npx vitest run tests/unit/lib/social/feed-queries.test.ts -x` | Wave 0 |
| SOCL-04 | Collection comparison produces correct 3 sets | unit | `npx vitest run tests/unit/lib/social/comparison.test.ts -x` | Wave 0 |
| SOCL-04 | Fallback matching on normalized artist+title | unit | `npx vitest run tests/unit/lib/social/comparison.test.ts -x` | Wave 0 |
| SOCL-05 | Public profile resolves by username | integration | `npx vitest run tests/integration/social/public-profile.test.ts -x` | Wave 0 |
| SOCL-05 | Username search with ILIKE | integration | `npx vitest run tests/integration/social/search.test.ts -x` | Wave 0 |
| SOCL-05 | Progress bar state computation | unit | `npx vitest run tests/unit/lib/social/progress.test.ts -x` | Wave 0 |

### Sampling Rate
- **Per task commit:** `npx vitest run tests/integration/social/ tests/unit/lib/social/ --reporter=verbose`
- **Per wave merge:** `npx vitest run`
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps
- [ ] `tests/integration/social/follow.test.ts` -- covers SOCL-01 (follow action, self-follow prevention, activity log)
- [ ] `tests/integration/social/unfollow.test.ts` -- covers SOCL-02 (unfollow action)
- [ ] `tests/integration/social/feed.test.ts` -- covers SOCL-03 (personal + global feed queries)
- [ ] `tests/unit/lib/social/feed-queries.test.ts` -- covers SOCL-03 (cursor pagination logic)
- [ ] `tests/unit/lib/social/comparison.test.ts` -- covers SOCL-04 (set operations, fallback matching)
- [ ] `tests/integration/social/public-profile.test.ts` -- covers SOCL-05 (username resolution)
- [ ] `tests/integration/social/search.test.ts` -- covers SOCL-05 (ILIKE search)
- [ ] `tests/unit/lib/social/progress.test.ts` -- covers SOCL-05/D-22 (progress bar state)
- [ ] Test pattern: follow existing mock patterns from `tests/integration/collection/add-record.test.ts` (chainable admin mock, module-level vi.mock)

## Sources

### Primary (HIGH confidence)
- [Drizzle ORM - Cursor-Based Pagination](https://orm.drizzle.team/docs/guides/cursor-based-pagination) - Composite cursor pattern with timestamp + ID
- [Drizzle ORM - Set Operations](https://orm.drizzle.team/docs/set-operations) - intersect, except, union operations
- [Drizzle ORM - Select / ilike](https://orm.drizzle.team/docs/select) - ILIKE operator for case-insensitive search
- [React 19 useOptimistic](https://react.dev/reference/react/useOptimistic) - API reference, reducer pattern, auto-revert on error
- [Next.js 15 Dynamic Routes](https://nextjs.org/docs/app/api-reference/file-conventions/dynamic-routes) - Async params in Next.js 15
- Existing codebase: `src/actions/collection.ts` - Server action pattern (admin client, auth check, error handling)
- Existing codebase: `src/lib/collection/queries.ts` - Drizzle query patterns (innerJoin, where conditions, pagination)
- Existing codebase: `src/lib/db/schema/social.ts` - follows + activityFeed table definitions with RLS

### Secondary (MEDIUM confidence)
- [react-intersection-observer npm](https://www.npmjs.com/package/react-intersection-observer) - v10.0.3, useInView hook for infinite scroll
- [LogRocket: Infinite Scroll with Next.js Server Actions](https://blog.logrocket.com/implementing-infinite-scroll-next-js-server-actions/) - Pattern for combining server actions with client-side scroll detection

### Tertiary (LOW confidence)
- None -- all findings verified against official docs or existing codebase patterns.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - All libraries already installed except react-intersection-observer (verified on npm registry)
- Architecture: HIGH - Patterns derived from existing codebase (Phase 4 collection patterns, server action patterns, Drizzle query patterns)
- Pitfalls: HIGH - Based on known Next.js 15 breaking changes (async params) and existing project constraints (PgBouncer, admin client)

**Research date:** 2026-03-26
**Valid until:** 2026-04-26 (stable -- all technologies are production releases, no beta/RC dependencies)
