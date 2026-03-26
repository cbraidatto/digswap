# Phase 7: Community + Reviews — Context

**Gathered:** 2026-03-26
**Status:** Ready for planning

<domain>
## Phase Boundary

Build the community layer on top of the existing social graph: transform `/comunidade` from a placeholder into a functional group discovery hub, implement group creation (public + private), join/leave mechanics, a group post feed with optional linked records, a review post type with star ratings, and inline review browsing on record search cards. Auto-generated genre groups exist from day 1.

No new auth infrastructure needed. DB schema (`groups`, `groupMembers`, `groupPosts`, `reviews`) is already in place from Phase 1. One migration required: add `release_id` column to `group_posts`.

Surfaces in scope:
- `/comunidade` — rewritten as a group discovery hub (replaces placeholder)
- `/comunidade/[slug]` — group detail page with post feed (new route)
- `/comunidade/new` — group creation form (new route)
- `/join/[token]` — invite link landing page (new route, for private groups)
- `/explorar` — record search cards gain a `reviews: N` expand section (Phase 6 surface, extended)
- `/feed` — gains `group_post` activity event type (Phase 5 surface, extended)

Out of scope for Phase 7:
- Post editing/deletion moderation tools
- Group admin transferral
- Group search by keyword (browse by genre only)
- Likes/reactions on posts (Phase 8 social layer)

</domain>

<decisions>
## Implementation Decisions

### Community Landing Page (`/comunidade`)

- **D-01:** `/comunidade` becomes a **group discovery hub**. Layout:
  - Section 1 `[ GENRE_GROUPS ]` — auto-seeded genre groups (Electronic, Jazz, Hip Hop, Rock, Soul, Latin, Classical, etc.), always visible, always have members. Sorted by member count desc.
  - Section 2 `[ MEMBER_GROUPS ]` — all user-created groups, paginated. Shows name, member count, `[PRIVATE]` badge if private, creator username.
  - `[+ CREATE_GROUP]` button in page header. Terminal label: `COMMUNITY_HUB` / `// {N} active groups`.
  - Genre filter chips to narrow the group list (genre column on `groups` table).

- **D-02:** Group detail route: `/comunidade/[slug]` where `slug` is generated from the group name (lowercase, hyphens). Group header shows: name, category/type (GENRE_GROUP or MEMBER_GROUP), member count, join/leave button (hidden on own-created groups if creator is sole admin), post feed below.

- **D-03:** Auto-seeded genre groups are created via a SQL seed script run at migration time. Creator is a dedicated system user (UUID stored in env/config). Genre groups are `visibility: 'public'` and `category` set to the genre name. No user can delete them (policy enforced at DB level by checking `creator_id = system_uuid`).

### Group Posts

- **D-04:** Post cards inside a group feed use a **simpler style than the main feed**:
  - Author username (link to `/perfil/[username]`) + `·` + relative timestamp header
  - Text body (max ~500 chars recommended, no hard limit)
  - Optional linked record as a compact inline reference: `└ LINKED: {Artist} - {Title} [{Label}, {Year}, {Format}] RARITY: {score}`
  - Separator line between posts (`─────`)
  - No accent color strip, no terminal metadata grid — those are for broadcast feed cards

- **D-05:** Linked record in a post: composer has a `[+ link record]` button that opens a search input. Reuses Phase 6 `searchRecordsAction` server action. User selects from search results → `releaseId` stored on the post. Requires migration: `ALTER TABLE group_posts ADD COLUMN release_id UUID REFERENCES releases(id)`.

- **D-06:** Group posts **DO appear in the main `/feed`** activity feed as `group_post` events. Visibility rule: appears in the feed of followers who are also members of that group (both conditions must be true). Feed card for `group_post`: compact card showing author, group name (link), truncated post text, and linked record if present. Reuses Phase 5 feed infrastructure (`activity_feed` table + `ActivityFeedCard` pattern).

### Reviews

- **D-07:** Reviews are a **special post type within a group feed**. In the group composer, a "Write a review" mode (or tab) adds a star rating field and requires a linked record. Visually distinct from regular posts: star rating displayed prominently in the card header, record title as the post title, review body below.

- **D-08:** Reviews use **5 whole stars** (integer 1–5). Matches existing DB schema (`rating integer`). Rendered as filled/empty star characters (`★★★★☆`).

- **D-09:** "Browse all reviews for a release" lives on the **record search card** from Phase 6 (`/explorar` RECORDS tab). Each `RecordSearchCard` gains a `reviews: N` count link. Clicking expands an inline panel below the card showing all reviews across all groups, sorted by date desc. Uses same `ilike` query infrastructure — new `getReviewsForRelease(releaseId)` server action. No new route needed.

### Private Groups

- **D-10:** Private groups are **visible but locked** in the discovery hub. They appear in `[ MEMBER_GROUPS ]` with a `[PRIVATE]` badge, creator name, and member count visible. Feed and member list are hidden. Non-members see an `[INVITE_ONLY]` label — no join button.

- **D-11:** Private group invite mechanism — **both methods**:
  1. **Username invite**: Group admin types a username on the group page → in-app notification sent to invited user (reuses Phase 6 `notifications` table + `NotificationBell`). New notification type: `group_invite` (add to `notifications` schema as dormant type).
  2. **Shareable link**: Admin generates a token-based invite link (`/join/[token]`). Token stored in a new `group_invites` table (or a simple `invite_token` column on `groups`). Anyone with the link can join the private group (until admin revokes it). Link displayed on the group settings panel.

### Claude's Discretion

- Slug generation from group name (lowercase, replace spaces with hyphens, strip special chars, add numeric suffix on conflict)
- Cursor-based pagination for group feed and review panel (same pattern as Phase 5/6)
- Group invite token generation (UUID or short random string)
- `group_invites` table vs `groups.invite_token` column decision
- Feed `group_post` card visual design (adapts Phase 5 feed card pattern, simpler)
- Composer UI implementation (modal dialog vs inline form)

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Database Schema
- `src/lib/db/schema/groups.ts` — groups, groupMembers, groupPosts tables + RLS policies
- `src/lib/db/schema/reviews.ts` — reviews table + RLS policies

### Existing Surfaces Being Extended
- `src/app/(protected)/(community)/comunidade/page.tsx` — current placeholder to be replaced
- `src/app/(protected)/(feed)/feed/` — activity feed infrastructure (group_post event wiring)
- `src/app/(protected)/(explore)/explorar/_components/record-search-card.tsx` — gains reviews panel
- `src/actions/discovery.ts` — searchRecordsAction reused in post composer

### Prior Phase Patterns
- `.planning/phases/05-social-layer/05-CONTEXT.md` — feed card patterns (D-04, D-05), activity_feed event types (D-03), follow pattern
- `.planning/phases/06-discovery-notifications/06-CONTEXT.md` — notification system (D-11, D-12, D-13) for group invite notifications

### Requirements
- `.planning/REQUIREMENTS.md` — COMM-01 through COMM-05, REV-01 through REV-03

</canonical_refs>

<specifics>
## Specific References

- Community landing visual: terminal label `COMMUNITY_HUB`, monospace dotted rows for groups (`Electronic ......... 1.2k members`), `[PRIVATE]` badge style
- Group detail visual: `ELECTRONIC // genre group · 1.2k members [JOINED]` header format
- Post card: `> username · 2h ago` header, `└ LINKED:` for record reference, `─────` separator
- Review card: `★★★★☆` star rendering, `· review ·` label in post header
- Record search card extension: `[reviews: 4] ↓ expand` inline expand button
- Discovery hub: `[+ CREATE_GROUP]` button, `// {N} active groups` subtitle

</specifics>

<deferred>
## Deferred Ideas

- Post editing and deletion (moderation tools — Phase 8+)
- Likes/reactions on group posts (Phase 8 social layer)
- Group search by keyword (browse by genre only in Phase 7)
- Group admin transfer
- Group analytics (member growth, post count over time)
- Pinned posts in groups

</deferred>

---

*Phase: 07-community-reviews*
*Context gathered: 2026-03-26 via /gsd:discuss-phase*
