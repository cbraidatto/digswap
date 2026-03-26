# Phase 6: Discovery + Notifications - Research

**Researched:** 2026-03-26
**Domain:** Full-text search, Supabase Realtime postgres_changes, Resend transactional email, notification preference UI
**Confidence:** HIGH

## Summary

Phase 6 builds four interconnected capabilities on top of existing infrastructure: (1) record search across all users' collections via PostgreSQL `ilike` on the `releases` table, (2) genre/decade browsing across the entire platform catalog, (3) real-time in-app notifications via Supabase Realtime `postgres_changes` on the `notifications` table, and (4) email notifications via Resend for wantlist matches. The wantlist match trigger hooks into the existing `addRecordToCollection` server action and the Discogs import pipeline's collection insert path.

All three database tables needed (`notifications`, `notificationPreferences`, `wantlistItems`) already exist in the Drizzle schema with appropriate RLS policies. No schema migration is required. The Supabase Realtime broadcast pattern is already established in Phase 3's `ImportBanner` component -- Phase 6 follows the same `channel.on()` subscription pattern but uses `postgres_changes` (INSERT events on the `notifications` table) instead of `broadcast` events. Resend SDK (`resend@6.9.4`) is already in `package.json`.

**Primary recommendation:** Use the admin client (`createAdminClient`) for all notification inserts (since the match trigger inserts notifications for OTHER users, bypassing the `notifications_insert_own` RLS policy). Use Supabase Realtime `postgres_changes` filtered by `user_id=eq.{userId}` for the bell icon live updates. Use Resend's simple `emails.send()` with plain HTML (no React Email in Phase 6). Enable the `notifications` table in the `supabase_realtime` publication via SQL migration.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- **D-01:** Browser push notifications (NOTF-03) deferred to Phase 11. Phase 6 delivers in-app (Realtime) + email (Resend) + preference settings only. Push requires service workers + VAPID keys and adds significant complexity.
- **D-02:** Collaborative filtering (DISC2-04) implemented as simple taste match -- SQL-based, no ML: "Records in your top genres you don't own yet" (rank by rarity desc, exclude owned) and "Records your followers own that you don't" (pull from followed users' collections, exclude user's own). Delivered as a "SUGGESTED_FOR_YOU" section on `/explorar`. No Jaccard similarity or algorithmic complexity.
- **D-03:** `/explorar` gains two tabs: DIGGERS (username search -- already built in Phase 5) and RECORDS (record name/artist search -- new in Phase 6). Tab bar at top of page.
- **D-04:** Record search: full-text search against `releases` table on `title + artist`. PostgreSQL `ilike` with `%term%` pattern. Debounced (300ms). Minimum 2 characters.
- **D-05:** Record search result card: title, artist, label, format, rarity score badge. Below card: compact owners list (avatar + username link + condition grade badge). If no owners: `[NO_OWNERS_IN_NETWORK]`.
- **D-06:** Genre/decade browse lives in RECORDS tab below search input. Filter chips: genre (Electronic, Jazz, Hip Hop, Rock, Soul, Latin, Classical, etc.) + decade (60s, 70s, 80s, 90s, 00s, 10s). Only one genre + one decade active at a time.
- **D-07:** Browse results: grid of collectionItems + releases joined from ALL users, ordered by rarity score desc. Reuses CollectionGrid pattern. Each card shows owner count instead of condition grade.
- **D-08:** Browse empty state: `[NO_RECORDS_FOUND]` terminal format. Only shows after filter applied.
- **D-09:** Bell icon in AppHeader next to avatar menu. Unread count badge (red dot, max "9+"). Zero unread = no badge.
- **D-10:** Click bell opens dropdown (max 5 recent). Each row: type icon + title + body snippet + timestamp. "Mark all read" button. "View all" link to `/notifications`.
- **D-11:** Notification types for Phase 6: `wantlist_match` (in-app + email). `trade_request`, `ranking_change`, `new_badge` placeholders (schema exists, triggers deferred).
- **D-12:** Real-time in-app delivery via Supabase Realtime subscription on `notifications` table filtered by `user_id`. New INSERT triggers bell badge increment.
- **D-13:** Realtime subscription lives in client component `NotificationBell` mounted in `AppHeader`. Subscription on mount, cleanup on unmount.
- **D-14:** Email via Resend. Plain HTML template. Subject: "Someone has a record from your wantlist". Body: record title + artist + owner username + link to `/perfil/[username]`.
- **D-15:** Match check runs inside `addRecord` server action AND inside import pipeline's `importComplete` path. After collection INSERT: query `wantlist_items` WHERE `release_id = newReleaseId AND user_id != currentUser`, for each match INSERT notification + send Resend email (if enabled in preferences).
- **D-16:** Email sends immediately on match (synchronous). No batching. Skip matching for releases without `discogs_release_id`.
- **D-17:** Notification preferences section in `/settings`. Toggle rows per event type. Future types shown as disabled toggles with phase badges.
- **D-18:** `notificationPreferences` row created with defaults on first load of settings notification section (lazy create).

### Claude's Discretion
- Implementation details for record search query optimization
- Component decomposition within the RECORDS tab
- Notification bell dropdown component internal structure
- Error handling patterns for Resend email failures
- Suggested-for-you query optimization approach

### Deferred Ideas (OUT OF SCOPE)
- Browser push notifications (NOTF-03) -- deferred to Phase 11
- Full collaborative filtering (Jaccard similarity) -- deferred to post-MVP
- Daily digest email batching -- Phase 6 sends immediately
- "Currently online" indicator (DISC2-V2-01) -- V2 item
- Scheduled trade requests (DISC2-V2-02) -- V2 item
- Trade request notification triggers -- deferred to Phase 9
- Ranking/badge notification triggers -- deferred to Phase 8
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| DISC2-01 | User can search by record name/artist and see which platform users have it | Record search via `ilike` on `releases.title` and `releases.artist`, joined with `collection_items` and `profiles` to show owners. Existing `releases` table has all fields needed. |
| DISC2-02 | User can browse collections filtered by genre and decade | Genre/decade filter chips on RECORDS tab. Existing `releases.genre` (text array) + `releases.year` (integer) + `getDecadeRange()` from `src/lib/collection/filters.ts` provide all primitives. Cross-user query omits `userId` filter. |
| DISC2-03 | User receives notification when a platform user has a record from their wantlist | Wantlist match trigger in `addRecordToCollection` + import pipeline. Query `wantlist_items` by `release_id`, INSERT into `notifications` via admin client, send Resend email. |
| DISC2-04 | Platform suggests records based on collection taste and similar diggers | Simple taste match SQL: top genres from user's collection, exclude owned releases, rank by rarity. Second query: releases owned by followed users but not by current user. |
| NOTF-01 | User receives in-app notifications for wantlist match, trade request, trade completed, ranking movement, new badge | `notifications` table exists with `type` column. Phase 6 implements `wantlist_match` trigger only. Other types are schema-ready but dormant. Supabase Realtime `postgres_changes` for live delivery. |
| NOTF-02 | User receives email notifications for wantlist match, trade request | Resend SDK already installed (`resend@6.9.4`). Plain HTML email template. Check `notificationPreferences.wantlistMatchEmail` before sending. Trade request email trigger deferred to Phase 9. |
| NOTF-03 | User can enable browser push notifications | DEFERRED to Phase 11 per D-01. `pushEnabled` column already exists in `notificationPreferences` schema. |
| NOTF-04 | User can configure which notification types they receive | Notification preferences section in `/settings`. Per-type toggles for in-app and email. `notificationPreferences` table has all columns. Lazy-create row on first settings visit. |
</phase_requirements>

## Project Constraints (from CLAUDE.md)

- **Solo developer** -- all architecture must favor simplicity
- **Stack**: Next.js 15.x, React 19.1.0, TypeScript 5.x, Supabase, Drizzle ORM, Tailwind CSS 4.x, shadcn/ui
- **Resend** for transactional email (already in package.json)
- **Supabase Realtime** for in-app notifications (already used in Phase 3)
- **Admin client** (`createAdminClient`) for bypassing RLS in server actions
- **Drizzle ORM** with `db` client for typed queries; Supabase admin for RLS-bypass operations
- **Ghost Protocol** design system: dark theme, terminal aesthetic, mono font, surface hierarchy
- **Testing**: Vitest for unit/integration, Playwright for E2E. Test pattern: `tests/unit/`, `tests/integration/`, `tests/e2e/`
- **Biome** for linting/formatting (not ESLint)

## Standard Stack

### Core (already installed)
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| @supabase/supabase-js | 2.100.0 | Realtime subscriptions + admin inserts | Already used for broadcast in Phase 3. postgres_changes for notification delivery. |
| resend | 6.9.4 | Transactional email | Already in package.json. Simple `emails.send()` API. 3,000 emails/month free. |
| drizzle-orm | 0.45.1 | Typed DB queries | Used throughout for collection, social, and feed queries. |
| zustand | 5.0.12 | Client state | Already used for import store. May use for notification bell unread count if needed. |
| lucide-react | 1.6.x | Icons | Bell icon, notification type icons. Already used throughout. |

### No New Dependencies Required
Phase 6 uses only existing dependencies. No `npm install` needed.

## Architecture Patterns

### Recommended Project Structure
```
src/
  actions/
    notifications.ts          # Server actions: markRead, markAllRead, getNotifications, getPreferences, updatePreferences
    discovery.ts              # Server actions: searchRecords, browseRecords, getSuggestions
  lib/
    notifications/
      queries.ts              # DB queries: getUnreadCount, getRecentNotifications, getNotificationPage
      match.ts                # Wantlist match logic: checkWantlistMatches(releaseId, excludeUserId)
      email.ts                # Resend email helper: sendWantlistMatchEmail(...)
    discovery/
      queries.ts              # DB queries: searchReleasesByTerm, browseReleasesByFilters, getSuggestedRecords
  app/
    (protected)/
      (explore)/
        explorar/
          page.tsx            # Rewrites: tab layout (DIGGERS | RECORDS)
          _components/
            search-section.tsx   # EXISTING: Phase 5 username search (DIGGERS tab content)
            records-tab.tsx      # NEW: record search + genre/decade browse
            record-search.tsx    # NEW: search input + results with owners list
            browse-filters.tsx   # NEW: genre/decade filter chips
            browse-grid.tsx      # NEW: cross-user collection grid (reuses CollectionGrid pattern)
            suggested-section.tsx # NEW: SUGGESTED_FOR_YOU section
      notifications/
        page.tsx              # Full notifications list page (paginated)
    (protected)/
      settings/
        page.tsx              # MODIFIED: adds notification preferences section
  components/
    shell/
      app-header.tsx          # MODIFIED: replaces static bell with NotificationBell
      notification-bell.tsx   # NEW: bell icon + dropdown + Realtime subscription
```

### Pattern 1: Wantlist Match Trigger (Server-Side)
**What:** After a collection item is inserted, check if any other user has that release on their wantlist. If so, create a notification and optionally send an email.
**When to use:** Inside `addRecordToCollection` server action and at the end of the Discogs import pipeline.
**Critical RLS Note:** The `notifications` table has `notifications_insert_own` policy requiring `userId = authUid`. But the match trigger inserts notifications for OTHER users. Must use `createAdminClient()` (service role key) to bypass RLS.

```typescript
// src/lib/notifications/match.ts
import { createAdminClient } from "@/lib/supabase/admin";
import { sendWantlistMatchEmail } from "./email";

export async function checkWantlistMatches(
  releaseId: string,
  excludeUserId: string, // The user who just added the record (don't notify them)
): Promise<void> {
  const admin = createAdminClient();

  // Find all wantlist entries for this release (excluding the adder)
  const { data: matches } = await admin
    .from("wantlist_items")
    .select("user_id")
    .eq("release_id", releaseId)
    .neq("user_id", excludeUserId);

  if (!matches || matches.length === 0) return;

  // Get release info for notification content
  const { data: release } = await admin
    .from("releases")
    .select("title, artist")
    .eq("id", releaseId)
    .single();

  if (!release) return;

  // Get adder's username for the notification
  const { data: adderProfile } = await admin
    .from("profiles")
    .select("username")
    .eq("id", excludeUserId)
    .single();

  for (const match of matches) {
    // Insert notification (admin bypasses RLS)
    await admin.from("notifications").insert({
      user_id: match.user_id,
      type: "wantlist_match",
      title: "Wantlist match found!",
      body: `${adderProfile?.username ?? "A digger"} has "${release.title}" by ${release.artist}`,
      link: `/perfil/${adderProfile?.username ?? ""}`,
      read: false,
    });

    // Check email preference before sending
    const { data: prefs } = await admin
      .from("notification_preferences")
      .select("wantlist_match_email")
      .eq("user_id", match.user_id)
      .maybeSingle();

    if (prefs?.wantlist_match_email !== false) {
      // Get recipient email from auth
      const { data: { user } } = await admin.auth.admin.getUserById(match.user_id);
      if (user?.email) {
        await sendWantlistMatchEmail(
          user.email,
          release.title,
          release.artist,
          adderProfile?.username ?? "someone",
        );
      }
    }
  }
}
```

### Pattern 2: Supabase Realtime postgres_changes Subscription
**What:** Client-side subscription to INSERT events on the `notifications` table, filtered by the current user's ID.
**When to use:** In the `NotificationBell` component mounted in `AppHeader`.
**Key difference from Phase 3:** Phase 3 used `broadcast` events (server pushes to channel). Phase 6 uses `postgres_changes` (automatic from DB INSERT). This requires enabling the `notifications` table in the `supabase_realtime` publication.

```typescript
// NotificationBell client component subscription pattern
useEffect(() => {
  const supabase = createClient();
  const channel = supabase
    .channel(`notifications-${userId}`)
    .on(
      "postgres_changes",
      {
        event: "INSERT",
        schema: "public",
        table: "notifications",
        filter: `user_id=eq.${userId}`,
      },
      (payload) => {
        // Increment unread count
        setUnreadCount((prev) => prev + 1);
        // Optionally prepend to recent list
        setRecentNotifications((prev) => [payload.new, ...prev].slice(0, 5));
      },
    )
    .subscribe();

  return () => {
    supabase.removeChannel(channel);
  };
}, [userId]);
```

### Pattern 3: Record Search Query
**What:** Full-text search across `releases` table on `title` and `artist`, then join with `collection_items` and `profiles` to show owners.
**When to use:** In the discovery server action called by the RECORDS tab search input.

```typescript
// src/lib/discovery/queries.ts
import { db } from "@/lib/db";
import { releases } from "@/lib/db/schema/releases";
import { collectionItems } from "@/lib/db/schema/collections";
import { profiles } from "@/lib/db/schema/users";
import { sql, eq, or, ilike } from "drizzle-orm";

export async function searchRecords(term: string, limit = 20) {
  const sanitized = term.replace(/[%_\\]/g, "\\$&");
  const pattern = `%${sanitized}%`;

  // Step 1: Find matching releases
  const matchingReleases = await db
    .select({
      id: releases.id,
      title: releases.title,
      artist: releases.artist,
      label: releases.label,
      format: releases.format,
      year: releases.year,
      genre: releases.genre,
      rarityScore: releases.rarityScore,
      coverImageUrl: releases.coverImageUrl,
    })
    .from(releases)
    .where(or(ilike(releases.title, pattern), ilike(releases.artist, pattern)))
    .orderBy(sql`COALESCE(${releases.rarityScore}, -1) DESC`)
    .limit(limit);

  // Step 2: For each release, get owners
  // (batch query to avoid N+1)
  const releaseIds = matchingReleases.map((r) => r.id);
  if (releaseIds.length === 0) return [];

  const owners = await db
    .select({
      releaseId: collectionItems.releaseId,
      userId: collectionItems.userId,
      username: profiles.username,
      avatarUrl: profiles.avatarUrl,
      conditionGrade: collectionItems.conditionGrade,
    })
    .from(collectionItems)
    .innerJoin(profiles, eq(collectionItems.userId, profiles.id))
    .where(sql`${collectionItems.releaseId} IN (${sql.join(releaseIds.map(id => sql`${id}`), sql`, `)})`);

  // Group owners by releaseId
  const ownersByRelease = new Map<string, typeof owners>();
  for (const owner of owners) {
    const key = owner.releaseId!;
    if (!ownersByRelease.has(key)) ownersByRelease.set(key, []);
    ownersByRelease.get(key)!.push(owner);
  }

  return matchingReleases.map((release) => ({
    ...release,
    owners: ownersByRelease.get(release.id) ?? [],
    ownerCount: (ownersByRelease.get(release.id) ?? []).length,
  }));
}
```

### Pattern 4: Resend Email (Plain HTML)
**What:** Send a simple transactional email when a wantlist match is found.
**When to use:** Inside the match trigger, after checking email preferences.

```typescript
// src/lib/notifications/email.ts
import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY);

export async function sendWantlistMatchEmail(
  to: string,
  recordTitle: string,
  recordArtist: string,
  ownerUsername: string,
): Promise<void> {
  try {
    const { error } = await resend.emails.send({
      from: "DigSwap <notifications@yourdomain.com>",
      to: [to],
      subject: "Someone has a record from your wantlist",
      html: `
        <div style="font-family: monospace; background: #10141a; color: #dfe2eb; padding: 24px;">
          <h2 style="color: #6fdd78;">Wantlist Match Found</h2>
          <p><strong>${recordTitle}</strong> by ${recordArtist}</p>
          <p>User <strong>${ownerUsername}</strong> has this record in their collection.</p>
          <p><a href="${process.env.NEXT_PUBLIC_APP_URL}/perfil/${ownerUsername}" style="color: #aac7ff;">View their profile</a></p>
        </div>
      `,
    });

    if (error) {
      console.error("Resend email error:", error);
    }
  } catch (err) {
    // Non-fatal: email failure should not break the add-record flow
    console.error("Failed to send wantlist match email:", err);
  }
}
```

### Anti-Patterns to Avoid
- **Using Drizzle `db` client for notification inserts:** The `notifications_insert_own` RLS policy prevents inserting notifications for other users. Always use `createAdminClient()` for cross-user notification inserts.
- **Using `broadcast` for notification delivery:** Phase 3 used broadcast (manual server push). Phase 6 should use `postgres_changes` (automatic on INSERT) -- simpler, no server-side broadcast code needed for notifications.
- **Blocking `addRecordToCollection` on email delivery:** Resend calls should be fire-and-forget (try/catch with console.error). A failed email should never prevent a record from being added.
- **N+1 queries in record search:** Don't fetch owners per-release in a loop. Batch query all owners for matched releases in a single query, then group client-side.
- **Full-text search index for MVP:** `ilike '%term%'` cannot use a B-tree index (it prevents index usage due to leading wildcard). For MVP scale this is fine. If it becomes slow, add a `tsvector` GIN index later. Don't over-optimize now.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Real-time notification delivery | Custom WebSocket server | Supabase Realtime `postgres_changes` | Already in the stack, handles connection management, reconnection, and filtering |
| Transactional email | Custom SMTP integration | Resend SDK (`resend.emails.send()`) | Already installed, handles deliverability, bounce handling, 3K free/month |
| Notification preferences schema | Custom key-value store | Existing `notificationPreferences` table | Already has per-type boolean columns for in-app and email |
| Debounced search input | Custom debounce hook | Same `setTimeout`/`clearTimeout` ref pattern from Phase 5 `SearchSection` | Proven pattern, 300ms debounce, `useRef`+`useCallback` |
| Genre/decade filter parsing | Custom decade parser | Existing `getDecadeRange()` from `src/lib/collection/filters.ts` | Already handles decade-to-year-range conversion |
| Rarity badge display | Custom rarity logic | Existing `getRarityTier()` + `getRarityBadgeVariant()` from `src/lib/collection/rarity.ts` | Already maps scores to tiers and badge variants |

## Common Pitfalls

### Pitfall 1: RLS Blocks Cross-User Notification Inserts
**What goes wrong:** Using the authenticated Supabase client (or Drizzle `db`) to insert a notification for another user fails silently due to `notifications_insert_own` RLS policy.
**Why it happens:** The RLS policy requires `user_id = auth.uid()`. When User A adds a record and the server tries to create a notification for User B, the authenticated client's JWT belongs to User A.
**How to avoid:** Always use `createAdminClient()` (service role key) for notification inserts in the match trigger. This bypasses RLS entirely.
**Warning signs:** Notifications never appear for matched users. No error in console (RLS silently drops the insert).

### Pitfall 2: Supabase Realtime Publication Not Enabled
**What goes wrong:** The `NotificationBell` component subscribes to `postgres_changes` on the `notifications` table, but never receives events.
**Why it happens:** Supabase Realtime requires the table to be added to the `supabase_realtime` publication. This is NOT automatic.
**How to avoid:** Run SQL: `ALTER PUBLICATION supabase_realtime ADD TABLE notifications;` -- either as a migration or via Supabase Dashboard.
**Warning signs:** Subscription succeeds (no error) but callback never fires on INSERT.

### Pitfall 3: Leading Wildcard ilike Defeats Indexes
**What goes wrong:** Record search with `ilike '%term%'` does a sequential scan on every query.
**Why it happens:** PostgreSQL B-tree indexes cannot be used with leading wildcards.
**How to avoid:** For MVP, accept the sequential scan -- the `releases` table is small enough. If it grows past ~50K rows and search becomes slow, add a `tsvector` column with a GIN index. Don't add the index prematurely.
**Warning signs:** Search queries taking >500ms. Monitor with Supabase Query Performance.

### Pitfall 4: Notification Flood During Bulk Import
**What goes wrong:** When a user imports a 5000-record Discogs collection, each record triggers wantlist match checks, potentially generating hundreds of notifications and emails.
**Why it happens:** The import pipeline processes records one by one, and each insert triggers the match logic.
**How to avoid:** For the import pipeline path, batch the match checks. Run them AFTER the import completes (not per-record). Alternatively, skip match checks during import entirely and run a single batch query at completion: "find all wantlist items where release_id IN (newly imported release IDs)".
**Warning signs:** Resend rate limit hit (3K emails/month). Hundreds of notifications flooding a user's bell.

### Pitfall 5: Email Address Retrieval Requires Admin Auth API
**What goes wrong:** The code tries to get a user's email from the `profiles` table, but email is stored in Supabase Auth (`auth.users`), not in `profiles`.
**Why it happens:** Supabase Auth manages user emails separately from application data. The `profiles` table doesn't have an `email` column.
**How to avoid:** Use `admin.auth.admin.getUserById(userId)` to retrieve the email. This requires the service role key (admin client).
**Warning signs:** `undefined` email, emails never sent despite preferences being enabled.

### Pitfall 6: Dropdown Z-Index Conflicts with Grain Overlay
**What goes wrong:** The notification bell dropdown appears behind the grain texture overlay.
**Why it happens:** The grain overlay uses `z-50` (from globals.css `.grain::after`). If the dropdown z-index is less than 50, it will be hidden behind the grain.
**How to avoid:** The AppHeader already uses `z-50`. The dropdown should use `z-[60]` or higher to appear above both the header and the grain overlay.
**Warning signs:** Dropdown renders but is not visible or not clickable.

## Code Examples

### Verified: Existing Debounced Search Pattern (from Phase 5 SearchSection)
```typescript
// Source: src/app/(protected)/(explore)/explorar/_components/search-section.tsx
const handleInputChange = useCallback(
  (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setQuery(value);

    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }

    if (value.trim().length < 2) {
      setResults([]);
      setSearched(false);
      return;
    }

    timeoutRef.current = setTimeout(() => {
      startTransition(async () => {
        const data = await searchRecords(value); // Changed from searchUsers
        setResults(data);
        setSearched(true);
      });
    }, 300);
  },
  [],
);
```

### Verified: Existing Supabase Realtime Subscription Pattern (from Phase 3 ImportBanner)
```typescript
// Source: src/components/discogs/import-banner.tsx
useEffect(() => {
  const supabase = createClient();
  const channel = supabase.channel(`notifications-${userId}`);

  channel
    .on("postgres_changes", {
      event: "INSERT",
      schema: "public",
      table: "notifications",
      filter: `user_id=eq.${userId}`,
    }, (payload) => {
      // Handle new notification
    })
    .subscribe();

  return () => {
    supabase.removeChannel(channel);
  };
}, [userId]);
```

### Verified: Existing Broadcast REST API Pattern (for import pipeline notifications)
```typescript
// Source: src/lib/discogs/broadcast.ts
// For the import pipeline path, use admin client direct INSERT instead of broadcast.
// The postgres_changes subscription will automatically pick up the INSERT.
const admin = createAdminClient();
await admin.from("notifications").insert({
  user_id: matchedUserId,
  type: "wantlist_match",
  title: "Wantlist match found!",
  body: `Someone has "${releaseTitle}" by ${releaseArtist}`,
  link: `/perfil/${ownerUsername}`,
  read: false,
});
// The client's postgres_changes subscription will fire automatically.
```

### Verified: Existing Admin Client Pattern
```typescript
// Source: src/lib/supabase/admin.ts
import { createAdminClient } from "@/lib/supabase/admin";
const admin = createAdminClient();
// Use admin for all cross-user operations (bypasses RLS)
```

### Existing Genre/Decade Utilities
```typescript
// Source: src/lib/collection/filters.ts
import { DECADES, getDecadeRange } from "@/lib/collection/filters";
// DECADES: [{label:"50s", startYear:1950}, ...]
// getDecadeRange("80s") => {start: 1980, end: 1990}

// Source: src/lib/discogs/taxonomy.ts
import { DISCOGS_GENRES } from "@/lib/discogs/taxonomy";
// DISCOGS_GENRES: ["Blues","Brass & Military","Children's","Classical","Electronic",...]
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Supabase Realtime `broadcast` (manual server push) | `postgres_changes` (automatic on DB mutation) | Available since Supabase Realtime v2 | No server-side broadcast code needed for notifications; INSERT triggers subscription automatically |
| React Email templates for Resend | Plain HTML for simple emails | Always valid | React Email adds complexity. For Phase 6's single template, plain HTML is faster to build and maintain. |
| Full-text search with `tsvector` | `ilike '%term%'` for MVP scale | N/A (scale-dependent) | `tsvector` adds migration complexity. `ilike` works for <50K rows. Upgrade path is clear when needed. |

**Deprecated/outdated:**
- `@supabase/auth-helpers-nextjs` -- replaced by `@supabase/ssr` (already using correct package)

## Open Questions

1. **Resend `from` domain verification**
   - What we know: Resend requires a verified domain for production sends. Development uses `onboarding@resend.dev`.
   - What's unclear: Whether the project has a verified domain in Resend yet.
   - Recommendation: Use `onboarding@resend.dev` for development/testing. Add a `RESEND_FROM_EMAIL` env var that defaults to the test address. Switch to verified domain before launch.

2. **Supabase Realtime publication setup**
   - What we know: The `notifications` table must be added to `supabase_realtime` publication for `postgres_changes` to work.
   - What's unclear: Whether this was already configured in Phase 1's schema setup (no migrations directory found).
   - Recommendation: Add `ALTER PUBLICATION supabase_realtime ADD TABLE notifications;` as a setup step in Wave 0. Check via Supabase Dashboard if already configured.

3. **Import pipeline batch match strategy**
   - What we know: Per-record match checks during a 5000-record import could generate excessive notifications.
   - What's unclear: Exact threshold where this becomes problematic.
   - Recommendation: For the import pipeline, collect all newly imported release IDs and run a single batch match query after import completes (not per-record). This is an optimization beyond D-15's specification but prevents notification flood.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Supabase | Realtime, Auth, DB | Assumed (cloud) | Managed | -- |
| Resend SDK | Email delivery | Installed | 6.9.4 | -- |
| RESEND_API_KEY env var | Email sending | Unknown (needs env) | -- | Skip email, log to console |
| NEXT_PUBLIC_APP_URL env var | Email link generation | Unknown (needs env) | -- | Hardcode localhost for dev |

**Missing dependencies with no fallback:**
- None -- all libraries are already installed.

**Missing dependencies with fallback:**
- `RESEND_API_KEY` -- if not set, email sending fails gracefully (try/catch in email helper). App continues to work, just without email notifications.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest 4.1.x + Playwright 1.58.x |
| Config file | `vitest.config.ts` (exists) |
| Quick run command | `npx vitest run --reporter=verbose` |
| Full suite command | `npx vitest run && npx playwright test` |

### Phase Requirements to Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| DISC2-01 | Record search returns matching releases with owners | unit | `npx vitest run tests/unit/discovery/search.test.ts -x` | Wave 0 |
| DISC2-02 | Genre/decade browse returns filtered results | unit | `npx vitest run tests/unit/discovery/browse.test.ts -x` | Wave 0 |
| DISC2-03 | Wantlist match triggers notification insert | unit | `npx vitest run tests/unit/notifications/match.test.ts -x` | Wave 0 |
| DISC2-04 | Taste match returns suggested records | unit | `npx vitest run tests/unit/discovery/suggestions.test.ts -x` | Wave 0 |
| NOTF-01 | Notification insert creates correct row | unit | `npx vitest run tests/unit/notifications/insert.test.ts -x` | Wave 0 |
| NOTF-02 | Email sent for wantlist match when enabled | unit | `npx vitest run tests/unit/notifications/email.test.ts -x` | Wave 0 |
| NOTF-03 | (DEFERRED) Push notifications | -- | -- | -- |
| NOTF-04 | Preferences lazy-created and toggleable | unit | `npx vitest run tests/unit/notifications/preferences.test.ts -x` | Wave 0 |

### Sampling Rate
- **Per task commit:** `npx vitest run --reporter=verbose`
- **Per wave merge:** `npx vitest run && npx playwright test`
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps
- [ ] `tests/unit/discovery/search.test.ts` -- covers DISC2-01
- [ ] `tests/unit/discovery/browse.test.ts` -- covers DISC2-02
- [ ] `tests/unit/discovery/suggestions.test.ts` -- covers DISC2-04
- [ ] `tests/unit/notifications/match.test.ts` -- covers DISC2-03, NOTF-01
- [ ] `tests/unit/notifications/email.test.ts` -- covers NOTF-02
- [ ] `tests/unit/notifications/preferences.test.ts` -- covers NOTF-04
- [ ] `tests/unit/components/shell/notification-bell.test.tsx` -- covers NOTF-01 UI

## Sources

### Primary (HIGH confidence)
- `src/lib/db/schema/notifications.ts` -- notifications + notificationPreferences table definitions (read directly)
- `src/lib/db/schema/wantlist.ts` -- wantlistItems table definition (read directly)
- `src/lib/db/schema/releases.ts` -- releases table with genre, year, rarityScore (read directly)
- `src/actions/collection.ts` -- addRecordToCollection server action (read directly, wantlist match hook point)
- `src/lib/discogs/import-worker.ts` -- processImportPage function (read directly, import pipeline hook point)
- `src/components/discogs/import-banner.tsx` -- Supabase Realtime subscription pattern (read directly)
- `src/lib/discogs/broadcast.ts` -- Supabase Broadcast REST API pattern (read directly)
- [Supabase Realtime Postgres Changes docs](https://supabase.com/docs/guides/realtime/postgres-changes) -- subscription API, publication requirement
- [Resend Next.js docs](https://resend.com/docs/send-with-nextjs) -- emails.send() API pattern

### Secondary (MEDIUM confidence)
- `src/app/(protected)/(explore)/explorar/page.tsx` -- current Explorar page structure (read directly, needs rewrite for tabs)
- `src/app/(protected)/(explore)/explorar/_components/search-section.tsx` -- Phase 5 debounce pattern (read directly)
- `src/lib/collection/queries.ts` -- collection query patterns, PAGE_SIZE, buildWhereConditions (read directly)
- `src/lib/collection/filters.ts` -- DECADES, getDecadeRange, CONDITION_GRADES (read directly)
- `src/lib/discogs/taxonomy.ts` -- DISCOGS_GENRES, full taxonomy (read directly)

### Tertiary (LOW confidence)
- None -- all findings verified from codebase and official docs.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH -- all dependencies already installed and used in prior phases
- Architecture: HIGH -- patterns established in Phase 3 (Realtime), Phase 4 (collection queries), Phase 5 (search)
- Pitfalls: HIGH -- RLS policy analysis from schema code, publication requirement from official docs
- Discovery queries: HIGH -- straightforward PostgreSQL `ilike` + joins on existing tables
- Email integration: MEDIUM -- Resend API verified from docs, but env var configuration not yet confirmed

**Research date:** 2026-03-26
**Valid until:** 2026-04-25 (stable -- no fast-moving dependencies)
