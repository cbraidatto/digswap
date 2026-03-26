# Phase 5: Social Layer — Context

**Gathered:** 2026-03-26
**Status:** Ready for planning

<domain>
## Phase Boundary

Build the social graph (follow/unfollow), wire the activity feed with real data, expose public profiles at `/perfil/[username]`, add collection comparison, and deliver the first-day onboarding progress bar. No new backend infrastructure — the DB schema for `follows` and `activity_feed` already exists from Phase 1. This phase wires it all up with UI and server actions.

Surfaces in scope:
- `/feed` — real activity feed (global curated + personal from followed diggers)
- `/perfil` — own profile gets following/follower counts + progress bar
- `/perfil/[username]` — public profile route (new)
- `/perfil/[username]/compare` — collection comparison route (new)
- `/explorar` — username search to find diggers

</domain>

<decisions>
## Implementation Decisions

### Activity Feed

- **D-01:** Feed shows two modes automatically:
  - **Before following anyone**: global feed, curated by popularity (simple score: rarity_score × recent interactions). Not raw chronological — ranked to surface interesting content to new users.
  - **After following**: personal feed from followed diggers, chronological (most recent first). Plus a "global" toggle to switch back.
- **D-02:** Infinite scroll for feed pagination. No "load more" button. Cursor-based pagination using `createdAt` timestamp.
- **D-03:** Events that trigger an `activity_feed` entry in Phase 5:
  - `added_record` — user added a record to collection (via Discogs import or manual). This is the primary event type.
  - `followed_user` — user started following another digger. Appears in followers' feeds.
  - No trades, reviews, or group events yet (those are Phase 7+).
- **D-04:** Feed card layout for `added_record` (full card, Ghost Protocol style):
  - Accent color strip at top (matches rarity tier: primary green = common, secondary blue = uncommon, tertiary orange = rare)
  - Header row: digger avatar placeholder + username (link to `/perfil/[username]`) + hash tag + timestamp + status label (`[NEW_FIND]`)
  - Content grid: cover art placeholder (left) + metadata (right): ARTIST / TITLE / GENRE / LABEL in terminal format
  - Rarity score badge visible on card (e.g., `RARITY: 4.2`)
  - No action buttons in Phase 5 (likes/comments are Phase 7 social layer)
- **D-05:** Feed card for `followed_user` events: compact inline line — `digger_x started following wax_prophet` with links to both profiles. Not a full card.
- **D-06:** Feed header text: `ARCHIVE_FEED` (already in place). Subtitle changes based on mode: global → `// ranked by rarity signal`, personal → `// signals from diggers you follow`.

### Public Profile (`/perfil/[username]`)

- **D-07:** Public profile route: `/perfil/[username]` where `username` is the unique handle from `profiles.username`. Own profile stays at `/perfil` (no username in URL for self).
- **D-08:** What's visible on a public profile:
  - ✅ Full collection with rarity scores
  - ✅ Condition grades (Mint/VG+/etc.) — visible to others
  - ✅ Filter bar (genre, decade, country, format, sort)
  - ✅ Follower / following counts
  - ❌ Personal notes — private, never shown to others
  - ❌ Discogs credentials — not exposed
- **D-09:** Public profile header: avatar placeholder, display name, username, bio (if set), follower/following counts, `Follow` / `Unfollow` button (hidden on own profile), `Compare Collection` button (hidden on own profile).
- **D-10:** Layout: same CollectionGrid + FilterBar + Pagination components reused. No rebuild needed — just server-side data fetching for the target user instead of current user.

### Follow System

- **D-11:** Follow action: server action triggered from Follow button on `/perfil/[username]`. Inserts into `follows` table. Optimistic UI update (button flips to Unfollow immediately, server confirms).
- **D-12:** Unfollow: same pattern — server action deletes from `follows` where `follower_id = current_user AND following_id = target`.
- **D-13:** Following/followers shown on own profile `/perfil` as counters: `X following · Y followers`. Clicking either opens an inline list (expand in-page, not a separate route) with links to each profile.
- **D-14:** Following/followers on public profile `/perfil/[username]`: same counters, same expand behavior. No Follow button on own profile.

### Digger Discovery

- **D-15:** Two discovery paths:
  - **Feed → profile**: every username in a feed card is a link to `/perfil/[username]`. Natural organic discovery.
  - **Explorar → search**: username search field on the `/explorar` page. Type username fragment → server-side search → list of matching profiles with Follow buttons.
- **D-16:** Explorar page gains a search input (currently just an empty state from Phase 4.5 work — not yet built). Phase 5 builds the username search there.

### Collection Comparison

- **D-17:** Comparison triggered from the `Compare Collection` button on `/perfil/[username]`. Navigates to `/perfil/[username]/compare`.
- **D-18:** Comparison page layout — 3 columns:
  - **Unique to you** (left): records you have, they don't
  - **In common** (middle): records both own (matched by Discogs release ID or title+artist)
  - **Unique to them** (right): records they have, you don't
  - Each column shows count at top, then scrollable list of records (artist + title + rarity score)
- **D-19:** Matching logic: match on `discogs_release_id` where both are non-null. If one or both are manual entries (no discogs_release_id), match on normalized `artist + title` string. No fuzzy matching — exact match only for Phase 5.
- **D-20:** Comparison page uses Ghost Protocol aesthetic: three panels side-by-side on desktop (stack vertically on mobile), surface-container-low backgrounds, primary/secondary/tertiary accent for each column header.

### First-Day Progress Bar

- **D-21:** Progress bar appears as a **banner at the top of the feed page** (`/feed`), above the feed items. Dismisses automatically once all 3 steps complete. Never manually dismissable — it stays until done.
- **D-22:** Three steps, each with a checkmark when completed:
  1. `[ Connect Discogs ]` — done when `profiles.discogs_connected = true`
  2. `[ Follow 3 diggers ]` — done when `follows` count (as follower) >= 3
  3. `[ Join a group ]` — **deferred to Phase 7** (groups don't exist yet). Step 3 shows as locked/greyed with a phase hint.
- **D-23:** Each step is a clickable link:
  - Step 1 → `/settings` (Discogs section)
  - Step 2 → `/explorar` (find diggers)
  - Step 3 → greyed out with `[PHASE_7]` badge
- **D-24:** Progress bar state is computed server-side on each feed load. No client-side persistence needed.

### Server Actions & Data

- **D-25:** Server actions needed:
  - `followUser(targetUserId)` — insert into follows
  - `unfollowUser(targetUserId)` — delete from follows
  - `logActivity(userId, actionType, targetType, targetId, metadata)` — insert into activity_feed (called internally by other actions)
- **D-26:** `logActivity` is called inside existing server actions:
  - Inside `addRecord` / `importComplete` → logs `added_record`
  - Inside `followUser` → logs `followed_user`
- **D-27:** Feed query for global (popularity): `SELECT * FROM activity_feed ORDER BY (rarity_score * interaction_weight) DESC LIMIT 20`. Exact formula: Claude's discretion — keep simple (rarity from releases table, no interaction count yet so sort by rarity desc + recency as tiebreaker).
- **D-28:** Feed query for personal (following): `SELECT * FROM activity_feed WHERE user_id IN (SELECT following_id FROM follows WHERE follower_id = $currentUser) ORDER BY created_at DESC LIMIT 20`.

</decisions>

<specifics>
## Specific Notes

- `follows` and `activity_feed` tables already exist in schema — no migration needed for the core social graph.
- `profiles.username` already exists as a unique column (added in Phase 4). Public profile route is immediately addressable.
- CollectionGrid, FilterBar, Pagination components from Phase 4 are fully reusable for public profiles — just pass different `userId` to the data fetching functions.
- The `/explorar` page is currently an empty state with no functionality. Phase 5 adds username search there.
- No real-time feed updates in Phase 5 — Supabase Realtime for feed is deferred to Phase 6 (notifications). Feed requires page refresh to see new items.
- Progress bar step 3 (Join group) is intentionally incomplete in Phase 5 — shown as locked with `[PHASE_7]` label. This is honest about the roadmap without hiding the feature.
- Condition grades are visible on public profiles. This was an explicit decision — it adds social context (e.g., seeing that someone has a Mint copy of a record you want).

</specifics>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Project context
- `.planning/PROJECT.md` — Product vision, 5-pillar architecture, social layer goals
- `.planning/ROADMAP.md` — Phase 5 success criteria, dependency on Phase 4.5

### Prior phase context
- `.planning/phases/04-collection-management/04-CONTEXT.md` — CollectionGrid, FilterBar, Pagination patterns
- `.planning/phases/04.5-template-alignment/04.5-CONTEXT.md` — Ghost Protocol visual language decisions

### Files to read before implementing
- `src/lib/db/schema/social.ts` — `follows` and `activity_feed` table definitions + RLS policies
- `src/lib/db/schema/users.ts` — `profiles` table with `username` column
- `src/lib/db/schema/collections.ts` — `collectionItems` structure for comparison queries
- `src/lib/db/schema/releases.ts` — `releases` table (rarity score fields)
- `src/app/(protected)/(profile)/perfil/page.tsx` — Own profile implementation (reuse pattern)
- `src/app/(protected)/(profile)/perfil/_components/` — All collection components (CollectionGrid, FilterBar, etc.)
- `src/app/(protected)/(feed)/feed/page.tsx` — Current empty state to replace with real feed
- `src/lib/collection/queries.ts` — Existing query patterns (getCollectionPage, etc.)
- `src/app/globals.css` — Ghost Protocol design tokens

</canonical_refs>

<deferred>
## Deferred Ideas

- Real-time feed updates via Supabase Realtime — deferred to Phase 6 (notifications infrastructure)
- Feed likes/comments/reactions — deferred to Phase 7 (social interactions layer)
- "Join a group" progress bar step — deferred to Phase 7 (groups don't exist yet)
- Wantlist matching (who has what I want) — Phase 6
- Algorithm sophistication (collaborative filtering, taste similarity) — post-MVP
- Block/mute users — deferred, no moderation scope in v1

</deferred>

---

*Phase: 05-social-layer*
*Context gathered: 2026-03-26*
