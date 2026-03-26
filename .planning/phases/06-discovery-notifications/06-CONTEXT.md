# Phase 6: Discovery + Notifications — Context

**Gathered:** 2026-03-26
**Status:** Ready for planning

<domain>
## Phase Boundary

Build record search and genre/decade browsing on `/explorar`, wire wantlist match detection into the collection add flow, deliver real-time in-app notifications via Supabase Realtime, send email for matches via Resend, and expose notification preferences in settings. No new DB schema needed — `notifications`, `notificationPreferences`, and `wantlistItems` tables all exist from Phase 1.

Surfaces in scope:
- `/explorar` — gains a RECORDS tab (record search + genre/decade browse) alongside the existing DIGGERS tab (Phase 5)
- AppHeader — gains a bell icon with dropdown panel + unread badge
- `/settings` — gains a Notifications section for per-type preference toggles
- `addRecord` server action — gains wantlist match check + notification insert + Resend email trigger

</domain>

<decisions>
## Implementation Decisions

### Push Notifications + Collaborative Filtering Scope

- **D-01:** Browser push notifications (NOTF-03) deferred to Phase 11. Phase 6 delivers in-app (Realtime) + email (Resend) + preference settings only. Push requires service workers + VAPID keys and adds significant complexity.

- **D-02:** Collaborative filtering (DISC2-04) implemented as **simple taste match** — SQL-based, no ML:
  - "Records in your top genres you don't own yet" — rank by rarity desc, exclude records the user already has
  - "Records your followers own that you don't" — pull from followed users' collections, exclude user's own
  - Delivered as a "SUGGESTED_FOR_YOU" section on `/explorar` (below the browse tabs)
  - No Jaccard similarity or algorithmic complexity in Phase 6

### Record Search UX

- **D-03:** `/explorar` gains two tabs: **DIGGERS** (username search — already built in Phase 5) and **RECORDS** (record name/artist search — new in Phase 6). Tab bar at top of page.

- **D-04:** Record search input: full-text search against `releases` table on `title + artist`. Use PostgreSQL `ilike` with `%term%` pattern. Debounced (300ms, same as Phase 5 username search). Minimum 2 characters to trigger.

- **D-05:** Record search result card layout:
  - Record card: title, artist, label, format, rarity score badge
  - Below card: compact owners list — each entry shows avatar placeholder + username (link to `/perfil/[username]`) + condition grade badge
  - If no owners: `[NO_OWNERS_IN_NETWORK]` — still shows the record card (may be in someone's wantlist or future addition)

### Genre/Decade Browse

- **D-06:** Genre/decade browse lives in the RECORDS tab (same tab as record search), below the search input. Filter chips: genre (Electronic, Jazz, Hip Hop, Rock, Soul, Latin, Classical, etc.) + decade (60s, 70s, 80s, 90s, 00s, 10s). Only one genre + one decade active at a time.

- **D-07:** Browse results: grid of `collectionItems` + `releases` joined, sourced from ALL users (no user filter), ordered by rarity score desc. Reuses `CollectionGrid` component pattern but with a different query. Each card shows owner count instead of condition grade.

- **D-08:** Browse empty state: `[NO_RECORDS_FOUND]` with terminal format. Only shows after filter is applied, not on initial tab load.

### Notification Bell

- **D-09:** Bell icon added to `AppHeader` next to the avatar menu. Shows unread count badge (red dot with number, max display "9+"). Zero unread = no badge.

- **D-10:** Click bell → dropdown panel (max 5 most recent notifications). Each row: icon (type-specific) + title + body snippet + timestamp. "Mark all read" button at bottom. "View all" link → `/notifications` page (simple list, same data, paginated).

- **D-11:** Notification types for Phase 6 (from NOTF-01 scope):
  - `wantlist_match` — "Someone has a record from your wantlist" — in-app + email
  - `trade_request` — placeholder for Phase 9 — in-app + email (schema exists, trigger deferred)
  - `ranking_change` — placeholder for Phase 8 — in-app only (schema exists, trigger deferred)
  - `new_badge` — placeholder for Phase 8 — in-app only (schema exists, trigger deferred)
  - Phase 6 only implements `wantlist_match` triggers. Others show in preferences but are dormant.

### Notification Delivery

- **D-12:** Real-time in-app delivery via **Supabase Realtime** subscription on `notifications` table filtered by `user_id = $currentUser`. New INSERT → bell badge increments instantly. Same pattern as Phase 3 import progress banner.

- **D-13:** Realtime subscription lives in a client component `NotificationBell` mounted inside `AppHeader`. Subscription established once on mount, cleaned up on unmount.

- **D-14:** Email delivery via **Resend**. Template: plain HTML (not React Email template in Phase 6 — keep simple). Subject: "Someone has a record from your wantlist". Body: record title + artist + owner username + link to `/perfil/[username]`.

### Wantlist Match Trigger

- **D-15:** Match check runs **inside `addRecord` server action** (and inside the Discogs import pipeline's `importComplete` path). After successful collection INSERT:
  1. Query `wantlist_items` WHERE `release_id = $newReleaseId` AND `user_id != $currentUser`
  2. For each match: INSERT into `notifications` + Resend email (if `wantlistMatchEmail = true` in preferences)
  3. Check `notificationPreferences` before sending email — skip if user disabled it
  4. Indexed lookup on `release_id` — fast even with many wantlist entries

- **D-16:** Email sends **immediately on match** (synchronous Resend API call). No batching or digest in Phase 6. If the release has no `discogs_release_id` (manual entry without Discogs ID), matching is skipped — too unreliable without a canonical ID.

### Notification Preferences

- **D-17:** Notification preferences section added to `/settings` page. Toggle rows per event type: wantlist match (in-app / email). Trade request, ranking change, new badge shown as disabled toggles with `[PHASE_9]` / `[PHASE_8]` badges — honest about roadmap.

- **D-18:** `notificationPreferences` row is created with defaults on first load of the settings notification section (lazy create, not on signup). Check existence before read; insert defaults if not found.

</decisions>

<specifics>
## Specific Notes

- `notifications`, `notificationPreferences`, `wantlistItems` tables all exist in schema — **no migration needed**.
- `/explorar` currently renders Phase 5's SearchSection (DIGGERS tab content). Phase 6 wraps this in a tabbed layout and adds the RECORDS tab content alongside it.
- `CollectionGrid` from Phase 4 is reusable for browse results — just change the query to pull from all users.
- Supabase Realtime already established in Phase 3 — `NotificationBell` client component can follow the same `channel.on('postgres_changes', ...)` pattern.
- Resend SDK already in CLAUDE.md stack — just needs env var `RESEND_API_KEY`.
- Push notifications deferred but `pushEnabled` column already exists in `notificationPreferences` — the schema is ready when Phase 11 implements it.
- Simple taste match suggestions are intentionally "best effort" — they can be empty if the user has no followers or their genre profile is sparse. Show `[NO_SUGGESTIONS_YET]` terminal empty state.

</specifics>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Project context
- `.planning/PROJECT.md` — Product vision, social layer goals, solo dev constraints
- `.planning/ROADMAP.md` — Phase 6 success criteria, dependency on Phase 5

### Prior phase context
- `.planning/phases/05-social-layer/05-CONTEXT.md` — Ghost Protocol decisions, feed patterns, Realtime usage
- `.planning/phases/04-collection-management/04-CONTEXT.md` — CollectionGrid, FilterBar, Pagination reuse patterns

### Files to read before implementing
- `src/lib/db/schema/notifications.ts` — `notifications` + `notificationPreferences` table definitions
- `src/lib/db/schema/wantlist.ts` — `wantlistItems` table definition
- `src/lib/db/schema/releases.ts` — `releases` table (search + browse query target)
- `src/actions/collection.ts` — existing `addRecord` action (match check hooks in here)
- `src/app/(protected)/(explore)/explorar/page.tsx` — current Explorar page (Phase 5 state)
- `src/app/(protected)/(explore)/explorar/_components/search-section.tsx` — Phase 5 username search component
- `src/components/shell/app-header.tsx` — AppHeader (bell icon adds here)
- `src/app/globals.css` — Ghost Protocol design tokens

</canonical_refs>

<deferred>
## Deferred Ideas

- Browser push notifications (NOTF-03) — deferred to Phase 11 (service workers + VAPID keys)
- Full collaborative filtering (DISC2-04 proper Jaccard similarity) — deferred to post-MVP
- Daily digest email batching — deferred, Phase 6 sends immediately
- "Currently online" indicator (DISC2-V2-01) — V2 item, deferred
- Scheduled trade requests (DISC2-V2-02) — V2 item, deferred
- Trade request notifications (NOTF-01/02 trade_request type) — trigger deferred to Phase 9 (P2P trading)
- Ranking/badge notifications (NOTF-01 ranking_change, new_badge) — trigger deferred to Phase 8 (gamification)

</deferred>

---

*Phase: 06-discovery-notifications*
*Context gathered: 2026-03-26*
