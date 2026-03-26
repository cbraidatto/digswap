# Phase 7: Community + Reviews - Research

**Researched:** 2026-03-26
**Domain:** Community groups, group feeds, reviews with star ratings, Drizzle migrations, Next.js App Router nested routes
**Confidence:** HIGH

## Summary

Phase 7 transforms the `/comunidade` placeholder into a functional group discovery hub, implements group creation (public + private), join/leave mechanics, a group post feed with optional linked records, a review post type with star ratings, and inline review browsing on record search cards. The database schema for `groups`, `groupMembers`, `groupPosts`, and `reviews` already exists from Phase 1, but two columns are missing: `slug` on `groups` and `release_id` on `group_posts`. A single Drizzle migration covers both additions plus a new `group_invites` table for private group invite links.

The primary technical challenge is wiring group posts into the existing `/feed` activity feed (Phase 5 infrastructure) with the visibility rule that `group_post` events only appear for followers who are also members of that group. The reviews system is a specialized post type within group feeds, and the "browse reviews for a release" feature extends the existing `RecordSearchCard` component from Phase 6.

All patterns (server actions, cursor-based pagination, Supabase Realtime notifications, Drizzle ORM queries with RLS policies) are already established in the codebase from Phases 5 and 6. No new libraries or tools are needed.

**Primary recommendation:** Build incrementally -- schema migration first, then group CRUD, then group posts/feed integration, then reviews, then record search card extension. Reuse existing patterns verbatim (server action auth pattern, feed card components, notification insertion via admin client).

<user_constraints>

## User Constraints (from CONTEXT.md)

### Locked Decisions

- **D-01:** `/comunidade` becomes a group discovery hub with genre groups section, member groups section, create button, and genre filter chips
- **D-02:** Group detail route: `/comunidade/[slug]` with slug from group name, header with join/leave button, post feed below
- **D-03:** Auto-seeded genre groups via SQL seed script, creator is system user UUID, `visibility: 'public'`, protected from deletion via DB policy
- **D-04:** Post cards in group feed use simpler style than main feed -- author + timestamp header, text body, optional linked record, separator lines, no accent strip or terminal metadata grid
- **D-05:** Linked record uses Phase 6 `searchRecordsAction` for record search, stores `releaseId` on post, requires migration `ALTER TABLE group_posts ADD COLUMN release_id`
- **D-06:** Group posts appear in `/feed` as `group_post` events, visible only to followers who are also group members. Compact card showing author, group name (link), truncated text, linked record
- **D-07:** Reviews are a special post type within group feed -- review mode adds star rating + requires linked record, visually distinct with prominent star rating
- **D-08:** Reviews use 5 whole stars (integer 1-5), rendered as filled/empty star characters
- **D-09:** "Browse all reviews" lives on `RecordSearchCard` from Phase 6 -- `reviews: N` count link expands inline panel showing all reviews sorted by date desc
- **D-10:** Private groups are visible but locked in discovery hub -- show badge, creator, member count but hide feed and member list for non-members
- **D-11:** Private group invite via both username invite (sends notification, new `group_invite` type) and shareable link (token-based `/join/[token]` route)

### Claude's Discretion

- Slug generation from group name (lowercase, replace spaces with hyphens, strip special chars, add numeric suffix on conflict)
- Cursor-based pagination for group feed and review panel (same pattern as Phase 5/6)
- Group invite token generation (UUID or short random string)
- `group_invites` table vs `groups.invite_token` column decision
- Feed `group_post` card visual design (adapts Phase 5 feed card pattern, simpler)
- Composer UI implementation (modal dialog vs inline form)

### Deferred Ideas (OUT OF SCOPE)

- Post editing and deletion (moderation tools -- Phase 8+)
- Likes/reactions on group posts (Phase 8 social layer)
- Group search by keyword (browse by genre only in Phase 7)
- Group admin transfer
- Group analytics (member growth, post count over time)
- Pinned posts in groups

</user_constraints>

<phase_requirements>

## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| COMM-01 | User can create a community group (genre, era, region, style) | D-01 group creation form at `/comunidade/new`, schema already has `groups` table with `category` field, need to add `slug` column |
| COMM-02 | User can join and leave groups | D-02 join/leave button on group detail, `groupMembers` table already exists with insert/delete RLS policies |
| COMM-03 | User can post text updates inside a group | D-04/D-05 group post composer with optional record link, `groupPosts` table exists, need `release_id` column migration |
| COMM-04 | User can view a group's activity feed | D-04 group detail page with post feed at `/comunidade/[slug]`, cursor-based pagination |
| COMM-05 | Group creator can set group visibility (public / premium-only) | D-10/D-11 `visibility` column already on `groups` table, private groups visible but locked, invite mechanism via token or username |
| REV-01 | User can rate and write a review for a specific pressing | D-07/D-08 reviews as special post type in group feed, `reviews` table has `isPressingSpecific` + `pressingDetails` fields, integer 1-5 rating |
| REV-02 | User can rate the general release (not pressing-specific) | D-07/D-08 same review form with `isPressingSpecific: false`, `reviews.releaseId` references `releases.id` |
| REV-03 | User can view all reviews for a pressing or release | D-09 inline expand panel on `RecordSearchCard`, `getReviewsForRelease(releaseId)` server action |

</phase_requirements>

## Standard Stack

### Core (already installed)

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Next.js | 15.5.14 | App Router, Server Actions, dynamic routes | Already in project, `/comunidade/[slug]` and `/join/[token]` use dynamic segments |
| React | 19.1.0 | UI components | Already in project |
| Drizzle ORM | 0.45.1 | Database queries + schema | Already in project, all existing queries use Drizzle pattern |
| Drizzle Kit | 0.31.10 | Schema migrations | Already in project, `drizzle-kit generate` + `drizzle-kit push` workflow |
| Supabase JS | 2.100.0 | Auth, Realtime subscriptions | Already in project, Realtime for notification delivery |
| Tailwind CSS | 4.x | Styling | Already in project |
| Zod | 4.3.6 | Form validation | Already in project, used for auth forms |
| React Hook Form | 7.72.0 | Form state management | Already in project |
| sonner | 2.0.7 | Toast notifications | Already in project |
| react-intersection-observer | 10.0.3 | Infinite scroll sentinel | Already in project, used in FeedContainer |

### No New Dependencies Required

This phase requires zero new npm packages. All functionality is built using existing libraries and patterns already established in the codebase.

## Architecture Patterns

### New Routes

```
src/app/(protected)/(community)/
  comunidade/
    page.tsx                    # REWRITE: group discovery hub (replaces placeholder)
    [slug]/
      page.tsx                  # NEW: group detail + post feed
    new/
      page.tsx                  # NEW: group creation form
  join/
    [token]/
      page.tsx                  # NEW: invite link landing page
```

### New Server-Side Modules

```
src/
  lib/
    community/
      queries.ts                # Group CRUD, member queries, post queries, review queries
      slugify.ts                # Slug generation utility
  actions/
    community.ts                # Server actions: createGroup, joinGroup, leaveGroup, createPost, createReview, generateInvite, acceptInvite
```

### Schema Changes (Migration Required)

```
src/lib/db/schema/
  groups.ts                     # ADD: slug column (varchar, unique), UPDATE: groupPosts ADD release_id column
  group-invites.ts              # NEW: group_invites table for invite tokens
```

### Pattern 1: Server Action Auth Pattern (reuse existing)

**What:** Every server action follows the same auth-check-first pattern established in Phases 3-6.
**When to use:** All new server actions in `src/actions/community.ts`.
**Example (from existing codebase):**

```typescript
// Source: src/actions/discovery.ts (existing pattern)
"use server";

import { createClient } from "@/lib/supabase/server";
import { db } from "@/lib/db";

export async function createGroupAction(data: { name: string; description?: string; category?: string; visibility: "public" | "private" }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    throw new Error("Not authenticated");
  }

  // ... implementation
}
```

### Pattern 2: Activity Feed Event Insertion (reuse existing)

**What:** When a group post is created, insert an `activity_feed` row with `actionType: "group_post"`.
**When to use:** In the `createPost` and `createReview` server actions.
**Example (from existing codebase):**

```typescript
// Source: src/actions/social.ts - logActivity function (existing)
import { logActivity } from "@/actions/social";

// After creating a group post:
await logActivity(user.id, "group_post", "group_post", post.id, {
  groupId: groupId,
  groupName: group.name,
  groupSlug: group.slug,
  content: content.slice(0, 200), // truncated for feed display
  releaseId: releaseId ?? null,
});
```

### Pattern 3: Feed Visibility Filtering for group_post Events

**What:** Group posts in the personal feed must satisfy BOTH conditions: the poster is followed by the viewer AND the viewer is a member of the group.
**When to use:** Extending `getPersonalFeed` and `getGlobalFeed` in `src/lib/social/queries.ts`.
**Implementation approach:**

```typescript
// In personal feed query, add a subquery condition for group_post events:
// For actionType = 'group_post', additionally require viewer membership:
// metadata->>'groupId' IN (SELECT group_id FROM group_members WHERE user_id = currentUserId)
//
// For all other action types, existing behavior unchanged.
```

**Key consideration:** The `metadata` JSONB column on `activity_feed` stores `groupId`. The feed query must extract this and check group membership. Two approaches:

1. **SQL subquery approach (recommended):** Add a WHERE clause that says: IF actionType = 'group_post' THEN metadata->>'groupId' must be in the viewer's group memberships. This keeps the filter at the database level for efficiency.

2. **Post-filter approach (simpler but wasteful):** Fetch all feed items, then filter group_post items client-side. Wastes bandwidth and pagination breaks.

Use approach 1.

### Pattern 4: Cursor-Based Pagination (reuse existing)

**What:** All list views use cursor-based pagination with `createdAt` as the cursor value.
**When to use:** Group feed, review list, group discovery list.
**Example (from existing codebase):**

```typescript
// Source: src/lib/social/queries.ts (existing pattern)
// cursor is an ISO date string, filter with lt(createdAt, new Date(cursor))
const conditions = cursor
  ? and(lt(groupPosts.createdAt, new Date(cursor)))
  : undefined;
```

### Pattern 5: Notification Insertion via Admin Client

**What:** Group invite notifications use the existing `notifications` table with type `group_invite`.
**When to use:** When a group admin invites a user by username.
**Example:**

```typescript
// Source: Follows pattern from Phase 6 wantlist match notifications
const admin = createAdminClient();
await admin.from("notifications").insert({
  user_id: invitedUserId,
  type: "group_invite",
  title: `You've been invited to join ${groupName}`,
  body: `${inviterUsername} invited you to the group "${groupName}"`,
  link: `/comunidade/${groupSlug}`,
  read: false,
});
```

### Anti-Patterns to Avoid

- **Building a custom notification system:** Reuse the existing `notifications` table + `NotificationBell` Realtime subscription. Do not create a separate notification mechanism for group invites.
- **Client-side feed filtering for group_post visibility:** Filter at the SQL level, not after fetch. Client-side filtering breaks cursor pagination and wastes bandwidth.
- **Storing review data in group_posts:** Reviews are a separate table (`reviews`) with a foreign key to `releases`. The `group_post` can reference a review via metadata, but the review data itself lives in `reviews`. This separation enables the "browse all reviews for a release" feature independently of groups.
- **Building a generic content management system:** Group posts are simple text + optional linked record. No rich text, no media uploads, no threading. Keep it minimal per the deferred items list.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Slug generation | Custom slug algorithm from scratch | Simple utility: lowercase, replace spaces/special chars with hyphens, strip non-alphanumeric, add numeric suffix on DB conflict | Straightforward ~15 lines, but must handle conflict resolution with a DB check |
| Invite tokens | Custom crypto token generation | `crypto.randomUUID()` for invite tokens | UUID v4 is cryptographically random, standard API available in Node.js |
| Star rating display | Custom SVG star component | Unicode star characters `\u2605` (filled) and `\u2606` (empty) per D-08 | User explicitly chose character-based star rendering |
| Form validation | Manual field checking | Zod schemas + React Hook Form (already in project) | Established pattern from auth forms |
| Infinite scroll | Custom scroll detection | `react-intersection-observer` (already installed) + existing `FeedContainer` sentinel pattern | Established pattern from Phase 5 feed |
| Toast feedback | Custom notification component | `sonner` toast (already installed) | Used throughout the app for action feedback |

## Common Pitfalls

### Pitfall 1: Missing slug Column on Groups Table

**What goes wrong:** The `groups` schema has no `slug` column. The route `/comunidade/[slug]` will fail to look up groups without it.
**Why it happens:** Phase 1 schema didn't include slug because it wasn't needed until now.
**How to avoid:** Add `slug: varchar("slug", { length: 250 }).unique().notNull()` to the `groups` schema in `src/lib/db/schema/groups.ts` and run `drizzle-kit generate` to create a migration. Genre seed script must also generate slugs.
**Warning signs:** 404 on group detail pages.

### Pitfall 2: Missing release_id Column on group_posts Table

**What goes wrong:** Posts with linked records cannot be saved because `release_id` doesn't exist on `group_posts`.
**Why it happens:** Phase 1 schema didn't include linked records for posts.
**How to avoid:** Add `releaseId: uuid("release_id").references(() => releases.id)` to the `groupPosts` schema and generate a migration. This must be nullable since most posts don't link a record.
**Warning signs:** Database error on post creation with linked record.

### Pitfall 3: Feed Query Complexity with Group Post Visibility

**What goes wrong:** Group posts appear to non-members in the feed, or the feed query becomes too slow due to subquery joins.
**Why it happens:** The visibility rule (follower AND group member) requires joining the `group_members` table in the feed query only for `group_post` action types.
**How to avoid:** Use a conditional SQL expression: `CASE WHEN action_type = 'group_post' THEN metadata->>'groupId' IN (SELECT group_id FROM group_members WHERE user_id = $currentUserId) ELSE true END`. Index `group_members(user_id, group_id)` for fast subquery.
**Warning signs:** Feed loading slowly or showing group posts from groups the user hasn't joined.

### Pitfall 4: Member Count Drift

**What goes wrong:** The `member_count` column on `groups` gets out of sync with actual `group_members` rows if join/leave operations fail midway.
**Why it happens:** Incrementing/decrementing `member_count` and inserting/deleting `group_members` rows are separate operations.
**How to avoid:** Use a database transaction wrapping both operations. Alternatively, compute `member_count` on-the-fly with a COUNT query (simpler, slightly slower). For Phase 7 scale, either approach works. Transaction is recommended for data integrity.
**Warning signs:** Group showing "0 members" when it has members, or negative member count.

### Pitfall 5: RLS Policy Gap for System-Created Genre Groups

**What goes wrong:** Genre groups created by a system user UUID cannot be deleted by regular users, but the current RLS policy allows deletion by `creator_id = auth.uid()`. A regular user could become the system user if the UUID leaks.
**Why it happens:** The system user is a convention, not enforced at the database level.
**How to avoid:** The system user UUID should be a dedicated Supabase Auth account that no human can log into (no password, no OAuth). Store the UUID as an environment variable. The existing `groups_delete_creator` policy already protects genre groups since no user will match the system UUID via `auth.uid()`. Additional safety: add a CHECK constraint or trigger that prevents deletion of groups where `category` matches a genre name.
**Warning signs:** Genre group disappearing from the hub.

### Pitfall 6: Review Duplication

**What goes wrong:** A user writes multiple reviews for the same release, flooding the review panel.
**Why it happens:** No unique constraint on `(userId, releaseId)` in the `reviews` table.
**How to avoid:** Add a unique constraint on `(userId, releaseId)` via migration. The server action should check for existing review and either reject or update. CONTEXT.md does not specify "one review per user per release" explicitly, but this is the expected behavior for rating systems. The unique constraint allows updating an existing review via upsert.
**Warning signs:** Same user with 5 reviews for the same record.

### Pitfall 7: Group Post vs Review Confusion in Data Model

**What goes wrong:** Unclear where review data lives -- in `group_posts` or `reviews` table?
**Why it happens:** D-07 says reviews are a "special post type within a group feed" but reviews also need to be queryable independently per D-09 (browse all reviews for a release).
**How to avoid:** Reviews live in the `reviews` table (already has `userId`, `releaseId`, `rating`, `title`, `body`). When a review is created, ALSO create a `group_post` row with `content` being the review body and `release_id` referencing the release. Store the `review_id` in `group_posts` metadata or add a `review_id` column. The feed shows the group post card; the review panel on RecordSearchCard queries the `reviews` table directly.
**Warning signs:** Reviews not appearing in group feed, or group feed reviews not appearing in the review panel.

## Code Examples

### Slug Generation Utility

```typescript
// src/lib/community/slugify.ts
export function slugify(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, "") // strip special chars
    .replace(/\s+/g, "-")          // spaces to hyphens
    .replace(/-+/g, "-")           // collapse multiple hyphens
    .replace(/^-|-$/g, "");        // trim leading/trailing hyphens
}
```

### Genre Seed Script Pattern

```sql
-- Seed script for auto-generated genre groups
-- System user UUID from environment variable
INSERT INTO groups (id, creator_id, name, slug, description, category, visibility, member_count)
VALUES
  (gen_random_uuid(), 'SYSTEM_USER_UUID', 'Electronic', 'electronic', 'All things electronic music', 'Electronic', 'public', 0),
  (gen_random_uuid(), 'SYSTEM_USER_UUID', 'Jazz', 'jazz', 'Jazz diggers unite', 'Jazz', 'public', 0),
  (gen_random_uuid(), 'SYSTEM_USER_UUID', 'Hip Hop', 'hip-hop', 'Hip hop heads and crate diggers', 'Hip Hop', 'public', 0),
  -- ... all 15 Discogs genres from DISCOGS_GENRES in taxonomy.ts
;
```

### Group Invites Table Schema

```typescript
// Recommendation: Use a separate group_invites table (not a column on groups)
// Reasoning: Multiple invite tokens per group, revocability, expiration
export const groupInvites = pgTable(
  "group_invites",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    groupId: uuid("group_id").references(() => groups.id).notNull(),
    token: varchar("token", { length: 36 }).unique().notNull(), // UUID
    createdBy: uuid("created_by").notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true }),  // nullable = never expires
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  // ... RLS policies
);
```

### Review Server Action Pattern

```typescript
// In src/actions/community.ts
export async function createReviewAction(data: {
  releaseId: string;
  groupId: string;
  rating: number;
  title?: string;
  body: string;
  isPressingSpecific: boolean;
  pressingDetails?: string;
}) {
  // 1. Auth check (standard pattern)
  // 2. Validate rating is 1-5 integer
  // 3. Check user is member of group
  // 4. Insert into reviews table
  // 5. Insert into group_posts table with review reference
  // 6. Log activity_feed event with actionType: "wrote_review"
  // 7. Return created review
}
```

### Star Rating Display

```typescript
// Inline star rendering per D-08
function StarRating({ rating }: { rating: number }) {
  const filled = "\u2605"; // black star
  const empty = "\u2606";  // white star
  return (
    <span className="font-mono text-secondary">
      {filled.repeat(rating)}{empty.repeat(5 - rating)}
    </span>
  );
}
// Renders: "3 stars" = ★★★☆☆
```

### Feed Query Extension for group_post Visibility

```typescript
// In getPersonalFeed - add conditional visibility for group_post events
// The key SQL fragment:
sql`
  CASE
    WHEN ${activityFeed.actionType} = 'group_post'
    THEN ${activityFeed.metadata}->>'groupId' IN (
      SELECT ${groupMembers.groupId}::text FROM ${groupMembers}
      WHERE ${groupMembers.userId} = ${currentUserId}
    )
    ELSE true
  END
`
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Placeholder comunidade page | Functional group discovery hub | Phase 7 | `/comunidade` becomes the community entry point |
| No group infrastructure | Full group CRUD + posts + reviews | Phase 7 | Social layer expands from follow/feed to communities |
| Reviews not linked to groups | Reviews as special post type in groups | Phase 7 decision | Reviews flow through groups, browsable independently on records |

**Deprecated/outdated:**
- The current `comunidade/page.tsx` placeholder with Swaps/Discussions/Crews tabs is entirely replaced. The new page has Genre Groups / Member Groups sections with a create button.

## Open Questions

1. **System User UUID for Genre Groups**
   - What we know: D-03 requires a system user UUID for genre group creation. The seed script needs this value.
   - What's unclear: How to create/store this system user. Options: (a) hardcode a UUID in the seed SQL and store it in `.env`, (b) create a Supabase Auth user programmatically during setup.
   - Recommendation: Use a hardcoded UUID stored in `SYSTEM_USER_ID` env variable. The seed script references this variable. No actual Supabase Auth user needed -- just a UUID that no real user will have. Document this in the project's env setup.

2. **Review Linkage Between group_posts and reviews Tables**
   - What we know: Reviews are displayed in group feeds AND independently on record search cards.
   - What's unclear: Whether to add a `review_id` column to `group_posts` or store the link in metadata JSONB.
   - Recommendation: Add a nullable `reviewId` column to `group_posts` schema (cleaner than metadata for querying). When a review is created, the group_post row references it. This allows the group feed to detect "this is a review post" and render it with stars.

3. **unique(userId, releaseId) Constraint on Reviews**
   - What we know: Most review systems allow one review per user per item. CONTEXT.md doesn't explicitly state this.
   - What's unclear: Should users be able to review the same release multiple times (e.g., once pressing-specific, once general)?
   - Recommendation: Add `unique(userId, releaseId)` constraint. If a user wants to update their review, use upsert. One review per user per release is the standard expectation.

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Vitest 3.x (jsdom environment) |
| Config file | `vitest.config.ts` |
| Quick run command | `npx vitest run --reporter=verbose` |
| Full suite command | `npx vitest run` |

### Phase Requirements to Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| COMM-01 | Create group with name, description, category, visibility | unit | `npx vitest run tests/unit/community/create-group.test.ts -t "create group"` | No -- Wave 0 |
| COMM-02 | Join group adds membership, leave group removes it | unit | `npx vitest run tests/unit/community/membership.test.ts -t "join|leave"` | No -- Wave 0 |
| COMM-03 | Create text post in group, optionally with linked record | unit | `npx vitest run tests/unit/community/group-post.test.ts -t "create post"` | No -- Wave 0 |
| COMM-04 | Group feed returns paginated posts for a group | unit | `npx vitest run tests/unit/community/group-feed.test.ts -t "feed"` | No -- Wave 0 |
| COMM-05 | Group visibility controls -- private groups hide feed from non-members | unit | `npx vitest run tests/unit/community/visibility.test.ts -t "private"` | No -- Wave 0 |
| REV-01 | Create pressing-specific review with rating 1-5 | unit | `npx vitest run tests/unit/community/review.test.ts -t "pressing"` | No -- Wave 0 |
| REV-02 | Create general release review with rating 1-5 | unit | `npx vitest run tests/unit/community/review.test.ts -t "general"` | No -- Wave 0 |
| REV-03 | Query all reviews for a release | unit | `npx vitest run tests/unit/community/review.test.ts -t "query reviews"` | No -- Wave 0 |

### Sampling Rate

- **Per task commit:** `npx vitest run tests/unit/community/ --reporter=verbose`
- **Per wave merge:** `npx vitest run`
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps

- [ ] `tests/unit/community/create-group.test.ts` -- covers COMM-01 (group creation, slug generation, validation)
- [ ] `tests/unit/community/membership.test.ts` -- covers COMM-02 (join, leave, member count)
- [ ] `tests/unit/community/group-post.test.ts` -- covers COMM-03 (post creation, linked record)
- [ ] `tests/unit/community/group-feed.test.ts` -- covers COMM-04 (feed query, pagination, feed integration)
- [ ] `tests/unit/community/visibility.test.ts` -- covers COMM-05 (public vs private visibility, invite mechanism)
- [ ] `tests/unit/community/review.test.ts` -- covers REV-01, REV-02, REV-03 (review CRUD, query by release)
- [ ] `tests/unit/community/slugify.test.ts` -- covers slug generation edge cases

## Project Constraints (from CLAUDE.md)

- **Solo developer:** All architecture must favor simplicity and solo maintainability
- **TypeScript:** Every file must be `.ts` or `.tsx`
- **Drizzle ORM:** Use Drizzle for all database queries, not Supabase client for data access (except admin client for RLS bypass)
- **Supabase Auth:** Auth via `createClient()` + `getUser()` pattern in all server actions
- **Tailwind CSS v4:** CSS-first config, use OKLCH variables defined at `:root`
- **shadcn/ui:** Component source copied into project, not imported as dependency
- **Biome:** Linting and formatting (`biome check`, `biome format`)
- **Vitest:** Unit/integration tests in `tests/` directory
- **Dark-only theme:** Single OKLCH variable set at `:root`, no `.dark` class
- **Monospace terminal aesthetic:** Font-mono, 10px labels, terminal-style labels like `COMMUNITY_HUB`
- **RLS policies:** All new tables must have Row Level Security enabled with appropriate policies
- **Admin client for cross-user operations:** Use `createAdminClient()` for operations that bypass RLS (e.g., notification insertion for other users, member count updates)
- **React 19.1.0:** Shipped by create-next-app, `useOptimistic` available for optimistic UI updates

## Database Schema Gap Analysis

### Existing Schema (from Phase 1)

| Table | Status | Columns Present | Missing |
|-------|--------|-----------------|---------|
| `groups` | Exists | id, creator_id, name, description, category, visibility, member_count, created_at, updated_at | `slug` (varchar, unique, not null) |
| `group_members` | Exists | id, group_id, user_id, role, joined_at | None -- complete |
| `group_posts` | Exists | id, group_id, user_id, content, created_at, updated_at | `release_id` (uuid, FK to releases, nullable), `review_id` (uuid, FK to reviews, nullable) |
| `reviews` | Exists | id, user_id, release_id, rating, title, body, is_pressing_specific, pressing_details, created_at, updated_at | Consider adding `unique(user_id, release_id)` constraint |
| `group_invites` | Does NOT exist | -- | Entire table needed for private group invite tokens |

### Migration Plan

One Drizzle migration covering:
1. `ALTER TABLE groups ADD COLUMN slug VARCHAR(250) UNIQUE NOT NULL` (with a default for existing rows if any -- but no production data exists yet, so safe to add as NOT NULL)
2. `ALTER TABLE group_posts ADD COLUMN release_id UUID REFERENCES releases(id)`
3. `ALTER TABLE group_posts ADD COLUMN review_id UUID REFERENCES reviews(id)`
4. `CREATE TABLE group_invites (...)` with RLS policies
5. `CREATE UNIQUE INDEX reviews_user_release ON reviews(user_id, release_id)`
6. Add indexes: `group_members(user_id, group_id)`, `group_posts(group_id, created_at DESC)`, `reviews(release_id, created_at DESC)`

### Seed Data

After migration, run a seed script that creates 15 genre groups matching `DISCOGS_GENRES` from `src/lib/discogs/taxonomy.ts`. Each genre group has:
- `creator_id` = system user UUID (from env)
- `name` = genre name (e.g., "Electronic")
- `slug` = slugified genre name (e.g., "electronic", "funk-soul", "folk-world-country")
- `category` = genre name (matches the filter)
- `visibility` = "public"
- `description` = brief description of the genre community

## Sources

### Primary (HIGH confidence)
- `src/lib/db/schema/groups.ts` -- existing groups, groupMembers, groupPosts schema (read directly)
- `src/lib/db/schema/reviews.ts` -- existing reviews schema (read directly)
- `src/lib/db/schema/social.ts` -- activity_feed + follows schema (read directly)
- `src/actions/social.ts` -- logActivity, followUser, loadMoreFeed patterns (read directly)
- `src/lib/social/queries.ts` -- getGlobalFeed, getPersonalFeed query patterns (read directly)
- `src/actions/discovery.ts` -- searchRecordsAction pattern (read directly)
- `src/lib/discovery/queries.ts` -- searchRecords query (read directly)
- `src/actions/notifications.ts` -- notification action patterns (read directly)
- `src/lib/notifications/queries.ts` -- notification query patterns (read directly)
- `src/components/shell/notification-bell.tsx` -- Realtime subscription pattern (read directly)
- `src/app/(protected)/(feed)/feed/_components/feed-card.tsx` -- feed card rendering pattern (read directly)
- `src/app/(protected)/(feed)/feed/_components/feed-container.tsx` -- infinite scroll pattern (read directly)
- `src/app/(protected)/(explore)/explorar/_components/record-search-card.tsx` -- record card to extend (read directly)
- `src/lib/discogs/taxonomy.ts` -- DISCOGS_GENRES array for seed script (read directly)
- `drizzle/0000_wandering_lord_hawal.sql` -- initial migration confirming current DB schema (read directly)

### Secondary (MEDIUM confidence)
- `.planning/research/DISCOGS_TAXONOMY.md` -- 15 official Discogs genres for auto-seeding
- `.planning/phases/07-community-reviews/07-CONTEXT.md` -- all implementation decisions D-01 through D-11

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH -- zero new dependencies, all libraries already in project and verified
- Architecture: HIGH -- all patterns directly derived from existing codebase (Phases 5-6)
- Pitfalls: HIGH -- identified from direct schema analysis and query pattern inspection
- Database: HIGH -- schema read directly, migration requirements verified against both Drizzle schema files and the initial SQL migration

**Research date:** 2026-03-26
**Valid until:** 2026-04-26 (stable -- no external dependency changes expected)
