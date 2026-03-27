# Phase 8: Gamification + Rankings - Research

**Researched:** 2026-03-27
**Domain:** PostgreSQL ranking computation, badge system, leaderboard UI, pg_cron scheduling
**Confidence:** HIGH

## Summary

Phase 8 wires the gamification layer into the existing DigSwap platform. The database schema (`userRankings`, `badges`, `userBadges`) already exists from Phase 1. The core work is: (1) a PostgreSQL function called by pg_cron every 15 minutes that computes `rarityScore` + `contributionScore` per user and assigns rank/title, (2) badge seed data + an `awardBadge()` utility triggered from existing server actions, (3) a RANKINGS tab on `/explorar`, and (4) replacing the profile stub (getRankTitle/getRankLevel) with real data from `user_rankings`.

The existing codebase patterns are well-established: Drizzle ORM queries in `src/lib/*/queries.ts`, server actions in `src/actions/`, tab navigation on `/explorar`, and the vi.mock() thenable chain test pattern. This phase introduces one new technical concept (pg_cron SQL function) but otherwise follows every existing pattern precisely.

**Primary recommendation:** Use a single PostgreSQL `SECURITY DEFINER` function (`recalculate_rankings()`) called by pg_cron every 15 minutes. This function bypasses RLS (runs as `postgres` superuser), computes both global and genre rankings in one pass, and upserts into `user_rankings`. Badge awards use the existing admin client pattern. No new npm dependencies are needed.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- **D-01:** Global score formula: `globalScore = rarityScore * 0.7 + contributionScore * 0.3`
- **D-02:** `rarityScore` uses logarithmic sum: `SUM(log(1 + release.rarityScore))` for all records in user's collection
- **D-03:** `contributionScore` point values: Review +10, Group post +3, Trade +15, Following +1, Receiving follow +2
- **D-04:** Rank titles: Vinyl Rookie (0-50), Crate Digger (51-200), Wax Prophet (201-500), Record Archaeologist (501+)
- **D-05:** Leaderboard lives as RANKINGS tab inside `/explorar` -- no separate `/rankings` route
- **D-06:** Leaderboard row format: `#[rank] . [username] . [title] . [score]pts` -- no avatar
- **D-07:** Two leaderboard scopes: Global + Per genre (matching auto-generated genre groups from Phase 7)
- **D-09:** Six badges in v1: first_dig, century_club, rare_find, critic, connector, crew_member
- **D-10:** Badges seeded via migration. `awardBadge(userId, slug)` utility, idempotent
- **D-12:** Rankings recalculated via pg_cron every 15 minutes
- **D-13:** Redis sorted sets deferred -- pg_cron sufficient for MVP

### Claude's Discretion
- Genre leaderboard navigation UI (visually distinctive, retro terminal aesthetic)
- Badge visual rendering on profile (ASCII/terminal style)
- Whether genre ranks are stored separately or computed at query time
- CONNECTOR badge stub -- show as locked/greyed until Phase 9 or omit entirely
- Leaderboard pagination approach

### Deferred Ideas (OUT OF SCOPE)
- Redis sorted sets for real-time ranking updates
- Per-genre rank stored on user profile ("Top 3% in Jazz")
- Monthly/weekly leaderboard periods
- Badge icons (image assets) -- v1 uses ASCII/terminal style slugs
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| GAME-01 | Each user has a global rank based on combined rarity score and community contribution | D-01/D-02/D-03 formula, pg_cron function, `user_rankings` table upsert |
| GAME-02 | User can view the global leaderboard | RANKINGS tab on `/explorar`, Drizzle query on `user_rankings` ORDER BY globalRank |
| GAME-03 | User can view leaderboards segmented by genre | Genre filter on leaderboard, query joining `collection_items` + `releases` filtered by genre array |
| GAME-04 | User earns badges for milestones | Badge seed migration, `awardBadge()` utility, triggers in existing server actions |
| GAME-05 | User has visible title on profile based on rank tier | Replace `getRankTitle()`/`getRankLevel()` stubs with `user_rankings` table read |
| GAME-06 | Community contribution score tracks trades, reviews, group activity | `contributionScore` computed from reviews count, group_posts count, follows, in pg_cron function |
</phase_requirements>

## Standard Stack

### Core (Already in project -- no new dependencies)
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Drizzle ORM | 0.45.x | Database queries | Already used for all data access. Leaderboard queries, badge queries follow existing patterns |
| Supabase pg_cron | 1.6.4 | Scheduled ranking recalculation | Native Supabase extension, runs as postgres superuser (bypasses RLS), zero infrastructure |
| Next.js App Router | 15.x | Server components for leaderboard tab | Existing pattern -- server component renders data, client components handle tab switching |

### Supporting (Already in project)
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| Supabase Admin Client | @supabase/supabase-js | Badge awards bypass RLS | Used for `awardBadge()` utility -- inserts into `user_badges` which has `supabaseAuthAdminRole` INSERT policy |
| Vitest | 4.1.1 | Unit testing | Test ranking computation logic, badge award idempotency, server action triggers |

### No New Dependencies
This phase requires zero new npm packages. Everything is built with existing Drizzle queries, PostgreSQL functions (pg_cron), and existing UI patterns.

## Architecture Patterns

### Recommended Project Structure
```
src/
  lib/
    gamification/
      queries.ts          # getLeaderboard(), getUserRanking(), getUserBadges(), getGenreLeaderboard()
      badge-awards.ts     # awardBadge(userId, slug), checkAndAwardBadges(userId, event)
      constants.ts        # RANK_TITLES, BADGE_DEFINITIONS, CONTRIBUTION_POINTS
  actions/
    gamification.ts       # Server action wrappers for client components (loadLeaderboard, etc.)
  app/(protected)/(explore)/explorar/
    _components/
      rankings-tab.tsx    # Main leaderboard component
      leaderboard-row.tsx # Single row: #[rank] . [username] . [title] . [score]pts
      genre-filter.tsx    # Genre filter for leaderboard scopes
  lib/db/seeds/
    badge-definitions.ts  # Seed script for 6 badge definitions
supabase/
  migrations/
    XXXX_ranking_function.sql  # pg_cron function + schedule
```

### Pattern 1: pg_cron Ranking Recalculation
**What:** A single PostgreSQL function `recalculate_rankings()` that:
1. Computes `rarityScore` per user: `SUM(ln(1 + COALESCE(r.rarity_score, 0)))` from `collection_items` JOIN `releases`
2. Computes `contributionScore` per user: weighted sum of reviews count, group_posts count, follows given, follows received
3. Calculates `globalScore = rarityScore * 0.7 + contributionScore * 0.3`
4. Assigns `globalRank` via `ROW_NUMBER() OVER (ORDER BY globalScore DESC)`
5. Assigns `title` based on score thresholds (D-04)
6. UPSERTs into `user_rankings`

**When to use:** Runs every 15 minutes via pg_cron. Also callable manually for testing.

**Critical Implementation Detail -- RLS:**
The `user_rankings` table currently has NO INSERT policy (only SELECT for all, UPDATE for own). The pg_cron function runs as `postgres` superuser which bypasses RLS entirely, so this is fine for the cron job. However, the schema should be updated to add an INSERT policy for `supabaseAuthAdminRole` for consistency with the project pattern (similar to `user_badges`), in case the admin client is ever used directly.

**Example SQL:**
```sql
-- Enable pg_cron extension (may already be enabled)
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- The ranking function
CREATE OR REPLACE FUNCTION recalculate_rankings()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER  -- Runs as function owner (postgres), bypasses RLS
AS $$
DECLARE
  threshold_rookie FLOAT := 50;
  threshold_digger FLOAT := 200;
  threshold_prophet FLOAT := 500;
BEGIN
  -- Upsert rankings for all users with collection items OR social activity
  WITH rarity AS (
    SELECT ci.user_id,
           COALESCE(SUM(ln(1 + COALESCE(r.rarity_score, 0))), 0) AS rarity_score
    FROM collection_items ci
    JOIN releases r ON r.id = ci.release_id
    GROUP BY ci.user_id
  ),
  contribution AS (
    SELECT p.id AS user_id,
           COALESCE(rev.cnt, 0) * 10 +
           COALESCE(gp.cnt, 0) * 3 +
           COALESCE(fg.cnt, 0) * 1 +
           COALESCE(fr.cnt, 0) * 2 AS contribution_score
    FROM profiles p
    LEFT JOIN (SELECT user_id, COUNT(*) AS cnt FROM reviews GROUP BY user_id) rev ON rev.user_id = p.id
    LEFT JOIN (SELECT user_id, COUNT(*) AS cnt FROM group_posts GROUP BY user_id) gp ON gp.user_id = p.id
    LEFT JOIN (SELECT follower_id AS user_id, COUNT(*) AS cnt FROM follows GROUP BY follower_id) fg ON fg.user_id = p.id
    LEFT JOIN (SELECT following_id AS user_id, COUNT(*) AS cnt FROM follows GROUP BY following_id) fr ON fr.user_id = p.id
  ),
  scores AS (
    SELECT
      COALESCE(r.user_id, c.user_id) AS user_id,
      COALESCE(r.rarity_score, 0) AS rarity_score,
      COALESCE(c.contribution_score, 0) AS contribution_score,
      COALESCE(r.rarity_score, 0) * 0.7 + COALESCE(c.contribution_score, 0) * 0.3 AS global_score
    FROM rarity r
    FULL OUTER JOIN contribution c ON r.user_id = c.user_id
  ),
  ranked AS (
    SELECT
      user_id,
      rarity_score,
      contribution_score,
      global_score,
      ROW_NUMBER() OVER (ORDER BY global_score DESC) AS global_rank,
      CASE
        WHEN global_score > threshold_prophet THEN 'Record Archaeologist'
        WHEN global_score > threshold_digger THEN 'Wax Prophet'
        WHEN global_score > threshold_rookie THEN 'Crate Digger'
        ELSE 'Vinyl Rookie'
      END AS title
    FROM scores
  )
  INSERT INTO user_rankings (user_id, rarity_score, contribution_score, global_rank, title, updated_at)
  SELECT user_id, rarity_score, contribution_score, global_rank, title, NOW()
  FROM ranked
  ON CONFLICT (user_id)
  DO UPDATE SET
    rarity_score = EXCLUDED.rarity_score,
    contribution_score = EXCLUDED.contribution_score,
    global_rank = EXCLUDED.global_rank,
    title = EXCLUDED.title,
    updated_at = NOW();
END;
$$;

-- Schedule via pg_cron (every 15 minutes)
SELECT cron.schedule(
  'recalculate-rankings',
  '*/15 * * * *',
  'SELECT recalculate_rankings()'
);
```

### Pattern 2: Badge Award Utility
**What:** An `awardBadge(userId, slug)` function that:
1. Looks up badge ID from slug (cache after first call or inline join)
2. Inserts into `user_badges` via admin client (bypasses RLS per existing policy)
3. Handles duplicate gracefully (ON CONFLICT DO NOTHING or check-before-insert)
4. Optionally creates a notification (type: "new_badge") via admin client

**When to use:** Called from within existing server actions after relevant events.

**Example TypeScript:**
```typescript
// src/lib/gamification/badge-awards.ts
import { createAdminClient } from "@/lib/supabase/admin";

export async function awardBadge(
  userId: string,
  badgeSlug: string,
): Promise<boolean> {
  const admin = createAdminClient();

  // Get badge ID from slug
  const { data: badge } = await admin
    .from("badges")
    .select("id, name")
    .eq("slug", badgeSlug)
    .single();

  if (!badge) return false;

  // Check if already awarded (idempotency)
  const { data: existing } = await admin
    .from("user_badges")
    .select("id")
    .eq("user_id", userId)
    .eq("badge_id", badge.id)
    .maybeSingle();

  if (existing) return false; // Already awarded

  // Award badge
  const { error } = await admin
    .from("user_badges")
    .insert({
      user_id: userId,
      badge_id: badge.id,
      earned_at: new Date().toISOString(),
    });

  if (error) return false;

  // Create notification
  await admin
    .from("notifications")
    .insert({
      user_id: userId,
      type: "new_badge",
      title: `Badge earned: ${badge.name}`,
      body: `You've earned the ${badge.name} badge!`,
      link: "/perfil",
    });

  return true;
}
```

### Pattern 3: Server Action Badge Triggers
**What:** Each existing server action gets a non-blocking `awardBadge()` call after its main operation.

**Integration points (from CONTEXT.md canonical refs):**
| Server Action | Badge Check | Trigger Condition |
|---------------|-------------|-------------------|
| `addRecordToCollection` (collection.ts) | `first_dig` | User's collection count reaches 1 (from any source) |
| `addRecordToCollection` (collection.ts) | `century_club` | User's collection count reaches 100 |
| `addRecordToCollection` (collection.ts) | `rare_find` | Added release has `rarityScore >= 2.0` |
| `createReviewAction` (community.ts) | `critic` | User's first review (reviews count = 1 for this user) |
| `joinGroupAction` (community.ts) | `crew_member` | User's first group join (group_members count = 1 for this user) |
| Import worker completion (route.ts) | `first_dig` | Collection import completed successfully |
| Import worker completion (route.ts) | `century_club` | Post-import collection count >= 100 |
| Import worker completion (route.ts) | `rare_find` | Any imported release has rarityScore >= 2.0 |

**Pattern:** Always wrap badge calls in try/catch. Badge failure MUST NOT fail the parent operation.

```typescript
// Inside addRecordToCollection, after successful insert:
try {
  const { data: countResult } = await admin
    .from("collection_items")
    .select("id", { count: "exact", head: true })
    .eq("user_id", user.id);
  const count = countResult ?? 0;

  if (count === 1) await awardBadge(user.id, "first_dig");
  if (count >= 100) await awardBadge(user.id, "century_club");

  // Check rare_find: was the added release Ultra Rare?
  const { data: release } = await admin
    .from("releases")
    .select("rarity_score")
    .eq("id", releaseId)
    .single();
  if (release?.rarity_score >= 2.0) await awardBadge(user.id, "rare_find");
} catch {
  // Non-blocking: badge award failure should not fail add-record
}
```

### Pattern 4: Genre Leaderboard Query
**What:** Genre leaderboard ranks users by rarity of records in that specific genre (per D-07). This is NOT the same as global rank filtered.

**Recommendation (Claude's Discretion area):** Compute genre leaderboards at query time rather than storing separately. Rationale:
- 15 genres x all users = many rows to maintain
- Genre leaderboard is a read on `/explorar` only, not a hot path
- The query joins `collection_items` + `releases` filtered by `releases.genre @> ARRAY[genreName]` and aggregates with `SUM(ln(1 + rarity_score))` per user
- Result set is small (paginated to ~50 rows), query is fast on indexed tables

```sql
-- Genre leaderboard query (Drizzle equivalent)
SELECT ci.user_id, p.username, p.display_name,
       SUM(ln(1 + COALESCE(r.rarity_score, 0))) AS genre_rarity_score,
       ROW_NUMBER() OVER (ORDER BY SUM(ln(1 + COALESCE(r.rarity_score, 0))) DESC) AS genre_rank
FROM collection_items ci
JOIN releases r ON r.id = ci.release_id
JOIN profiles p ON p.id = ci.user_id
WHERE r.genre @> ARRAY['Jazz']::text[]
GROUP BY ci.user_id, p.username, p.display_name
ORDER BY genre_rarity_score DESC
LIMIT 50 OFFSET 0;
```

### Pattern 5: Explorar Tab Extension
**What:** The `/explorar` page (client component with useState tabs) gets a third tab: `RANKINGS`.

**Current code:** `explorar/page.tsx` uses `useState<"diggers" | "records">`. Extend to `"diggers" | "records" | "rankings"`. Add a `RankingsTab` component rendered when `activeTab === "rankings"`.

**Tab URL:** `?tab=rankings` deep-link support (matching existing `?tab=records` pattern from Phase 6).

### Anti-Patterns to Avoid
- **Computing rankings in application code on every request:** Would be O(N users * M records) per page load. pg_cron pre-computes and stores.
- **Using Drizzle for the pg_cron function:** pg_cron runs raw SQL inside PostgreSQL. The ranking function MUST be a native PostgreSQL function, not a Drizzle query.
- **Storing genre rankings in a separate table for MVP:** Over-engineering. Query-time computation is fast enough with indexes on `collection_items(user_id)` and `releases(genre)`.
- **Awarding badges from the pg_cron function:** Badge awards should be event-driven (server action triggers), not batch-computed. Otherwise there is a 15-minute delay before a user sees their badge.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Scheduled jobs | Custom setInterval/cron service | Supabase pg_cron | Already available, runs as postgres superuser, zero infrastructure |
| Rank computation | Application-side aggregation loops | PostgreSQL window functions (ROW_NUMBER) | Database is orders of magnitude faster for this; single query vs N queries |
| RLS bypass for badge inserts | Custom auth middleware | Supabase admin client (service role) | Already established pattern in this codebase |
| Logarithmic rarity formula | Custom Math.log in JS | PostgreSQL `ln()` function | Computed in the database where all the data lives -- avoids round-trip |

## Common Pitfalls

### Pitfall 1: user_rankings INSERT Policy Missing
**What goes wrong:** The `user_rankings` schema has no INSERT policy. The pg_cron function bypasses RLS (runs as postgres), so this works for the cron job. But if any future code tries to insert via the Drizzle client (which runs as authenticated role), it will fail silently.
**Why it happens:** Phase 1 schema defined UPDATE policy for own user but forgot INSERT.
**How to avoid:** Add `supabaseAuthAdminRole` INSERT policy to `user_rankings` schema, similar to `user_badges`. Generate a Drizzle migration.
**Warning signs:** "0 rows inserted" with no error when using admin client.

### Pitfall 2: Badge Award Race Condition on Import
**What goes wrong:** A Discogs import adds 500 records. Each record could trigger `century_club` check. Without idempotency, the badge is awarded 400+ times.
**Why it happens:** Import processes records sequentially; each calls `awardBadge()`.
**How to avoid:** `awardBadge()` checks for existing award before inserting (check-before-insert pattern, already in the example above). Also add a unique constraint on `user_badges(user_id, badge_id)` if not present.
**Warning signs:** Duplicate badge notifications.

### Pitfall 3: Import Worker Badge Checks Too Expensive
**What goes wrong:** Adding badge checks inside the per-record import loop makes imports slower (extra DB queries per record).
**Why it happens:** Each `awardBadge()` call does 2-3 queries (lookup badge, check existing, insert).
**How to avoid:** For bulk imports, run badge checks ONCE after the import completes (in the import route.ts completion handler), not per-record. For manual `addRecordToCollection`, the overhead of 1 badge check is acceptable.
**Warning signs:** Import times increase noticeably after Phase 8.

### Pitfall 4: Genre Leaderboard Performance with `@>` Array Operator
**What goes wrong:** The `genre @> ARRAY['Jazz']::text[]` filter on releases table with no GIN index is slow for large tables.
**Why it happens:** Array containment operator needs a GIN index to be efficient.
**How to avoid:** Create a GIN index on `releases.genre` if not present: `CREATE INDEX IF NOT EXISTS idx_releases_genre_gin ON releases USING gin(genre)`.
**Warning signs:** Genre leaderboard page load > 2 seconds.

### Pitfall 5: Profile Stub Not Fully Replaced
**What goes wrong:** The profile page still shows the old XP/level system alongside new rank data, creating a confusing dual display.
**Why it happens:** `getRankTitle()`, `getRankLevel()`, `xp`, `xpInLevel`, `xpProgressPct` variables are all over the template.
**How to avoid:** Remove ALL stub variables and functions. Replace with a single `userRanking` object from the `user_rankings` table. Remove the XP progress bar entirely (replaced by global score display).
**Warning signs:** "LVL_" text still visible on profile after Phase 8.

### Pitfall 6: pg_cron Function Using ln(0) or ln(negative)
**What goes wrong:** `ln(0)` is undefined in PostgreSQL and will cause a runtime error, crashing the ranking function.
**Why it happens:** If `rarity_score` is NULL or 0, then `ln(1 + 0)` = `ln(1)` = 0 (safe). But if `rarity_score` is somehow -1 or less, `ln(1 + (-1))` = `ln(0)` = error.
**How to avoid:** Use `COALESCE(r.rarity_score, 0)` AND ensure `1 + rarity_score > 0`. Since `computeRarityScore()` returns null or positive values (want/have ratio), `COALESCE` to 0 is sufficient. The formula `ln(1 + x)` where x >= 0 is always safe.
**Warning signs:** pg_cron job fails silently; rankings stop updating.

## Code Examples

### Leaderboard Query (Drizzle)
```typescript
// src/lib/gamification/queries.ts
import { db } from "@/lib/db";
import { userRankings } from "@/lib/db/schema/gamification";
import { profiles } from "@/lib/db/schema/users";
import { eq, asc, sql } from "drizzle-orm";

export interface LeaderboardEntry {
  userId: string;
  username: string | null;
  displayName: string | null;
  globalRank: number | null;
  title: string | null;
  globalScore: number;
}

export async function getGlobalLeaderboard(
  page = 1,
  pageSize = 50,
): Promise<LeaderboardEntry[]> {
  return db
    .select({
      userId: userRankings.userId,
      username: profiles.username,
      displayName: profiles.displayName,
      globalRank: userRankings.globalRank,
      title: userRankings.title,
      globalScore: sql<number>`${userRankings.rarityScore} * 0.7 + ${userRankings.contributionScore} * 0.3`,
    })
    .from(userRankings)
    .innerJoin(profiles, eq(userRankings.userId, profiles.id))
    .orderBy(asc(userRankings.globalRank))
    .limit(pageSize)
    .offset((page - 1) * pageSize);
}
```

### Badge Seed Script
```typescript
// src/lib/db/seeds/badge-definitions.ts
import { db } from "@/lib/db";
import { badges } from "@/lib/db/schema/gamification";

const BADGE_DEFINITIONS = [
  { slug: "first_dig",    name: "FIRST_DIG",    description: "Completed your first Discogs import" },
  { slug: "century_club", name: "CENTURY_CLUB", description: "100 records in your collection" },
  { slug: "rare_find",    name: "RARE_FIND",    description: "Added an Ultra Rare record (rarity >= 2.0)" },
  { slug: "critic",       name: "CRITIC",       description: "Wrote your first review" },
  { slug: "connector",    name: "CONNECTOR",    description: "Completed your first trade" },
  { slug: "crew_member",  name: "CREW_MEMBER",  description: "Joined your first community group" },
];

async function seedBadges() {
  await db.insert(badges).values(BADGE_DEFINITIONS).onConflictDoNothing();
  console.log(`Seeded ${BADGE_DEFINITIONS.length} badge definitions.`);
}

seedBadges()
  .then(() => process.exit(0))
  .catch((err) => { console.error(err); process.exit(1); });
```

### Profile Rank Display (replacing stub)
```typescript
// In perfil/page.tsx -- replace getRankTitle/getRankLevel stubs:
const [ranking] = await db
  .select({
    rarityScore: userRankings.rarityScore,
    contributionScore: userRankings.contributionScore,
    globalRank: userRankings.globalRank,
    title: userRankings.title,
  })
  .from(userRankings)
  .where(eq(userRankings.userId, user.id))
  .limit(1);

// Fallback for users with no ranking yet (cron hasn't run):
const rankTitle = ranking?.title ?? "Vinyl Rookie";
const globalRank = ranking?.globalRank ?? null;
const rarityScore = ranking?.rarityScore ?? 0;
const contributionScore = ranking?.contributionScore ?? 0;
const globalScore = rarityScore * 0.7 + contributionScore * 0.3;
```

### Badge Display on Profile
```typescript
// Fetch user's badges
const userBadgeData = await db
  .select({
    slug: badges.slug,
    name: badges.name,
    earnedAt: userBadges.earnedAt,
  })
  .from(userBadges)
  .innerJoin(badges, eq(userBadges.badgeId, badges.id))
  .where(eq(userBadges.userId, user.id))
  .orderBy(asc(userBadges.earnedAt));

// Render as terminal-style badges:
// [FIRST_DIG] [CENTURY_CLUB] [RARE_FIND] [CRITIC]
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Profile uses `getRankTitle(collectionCount)` stub | Reads from `user_rankings` table | Phase 8 | Real ranking based on formula, not just collection count |
| XP system (collectionCount * 10) | Global score (rarity * 0.7 + contribution * 0.3) | Phase 8 | Meaningful ranking that rewards rare finds and community |
| No badges | 6 milestone badges | Phase 8 | Gamification hooks into existing actions |

**Deprecated/outdated:**
- `getRankTitle()` function in `perfil/page.tsx` line 36-41: Remove entirely
- `getRankLevel()` function in `perfil/page.tsx` line 43-45: Remove entirely
- `xp`, `xpInLevel`, `xpProgressPct`, `nextLevel` variables in `perfil/page.tsx` lines 94-97: Remove entirely
- The XP progress bar UI (lines 218-231 in perfil/page.tsx): Remove or replace with score display
- `XP_SCORE` and `LEVEL` stat cards in the stats row (lines 362-363): Replace with RANK and SCORE

## Open Questions

1. **user_badges unique constraint**
   - What we know: `userBadges` table has `(userId, badgeId)` but no explicit unique constraint on this pair in the schema
   - What's unclear: Whether the Drizzle migration created a unique constraint or just the columns
   - Recommendation: Add explicit `unique("user_badges_user_badge").on(table.userId, table.badgeId)` to schema and generate migration. This ensures database-level idempotency for badge awards.

2. **CONNECTOR badge handling**
   - What we know: Trades don't exist until Phase 9. CONNECTOR badge cannot be earned yet.
   - What's unclear: Whether to show it greyed out on profile or omit entirely
   - Recommendation (Claude's Discretion): Seed the badge definition but do NOT show unearned badges on profile. When Phase 9 adds trades, the trigger will award it. Simpler and cleaner than a "locked badge" UI.

3. **Genre leaderboard genre list**
   - What we know: D-07 says "Electronic, Jazz, Hip Hop, Rock, Soul, Latin, Classical". The seed groups use all 15 Discogs genres.
   - What's unclear: Whether leaderboard should show all 15 or just the 7 mentioned
   - Recommendation: Use the full 15 Discogs genres from `DISCOGS_GENRES` constant. The 7 mentioned in discussion were examples, not an exhaustive list. Filter by groups that have `category` matching genre name.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| pg_cron extension | Ranking recalculation (D-12) | Assumed (Supabase managed) | 1.6.4 | Manual recalculation via API route |
| PostgreSQL ln() function | Rarity score formula (D-02) | Yes (native PostgreSQL) | N/A | N/A |
| Vitest | Unit tests | Yes | 4.1.1 | N/A |
| Drizzle Kit | Schema migration | Yes | 0.30.x | N/A |

**Missing dependencies with no fallback:** None -- pg_cron is a Supabase standard extension available on all plans.

**Note on pg_cron:** The extension must be enabled in the Supabase dashboard (Database > Extensions > pg_cron). If running locally with `supabase start`, pg_cron is available by default. The ranking function and schedule should be created via a Supabase migration SQL file.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest 4.1.1 |
| Config file | `vitest.config.ts` |
| Quick run command | `npx vitest run --reporter=verbose` |
| Full suite command | `npx vitest run` |

### Phase Requirements to Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| GAME-01 | Global rank computed from rarity + contribution | unit | `npx vitest run tests/unit/gamification/ranking-computation.test.ts -x` | Wave 0 |
| GAME-02 | Global leaderboard query returns ranked users | unit | `npx vitest run tests/unit/gamification/leaderboard-queries.test.ts -x` | Wave 0 |
| GAME-03 | Genre leaderboard filters by genre correctly | unit | `npx vitest run tests/unit/gamification/genre-leaderboard.test.ts -x` | Wave 0 |
| GAME-04 | Badge awarded on milestone (idempotent) | unit | `npx vitest run tests/unit/gamification/badge-awards.test.ts -x` | Wave 0 |
| GAME-05 | Profile displays rank title from user_rankings | unit | `npx vitest run tests/unit/gamification/profile-ranking.test.ts -x` | Wave 0 |
| GAME-06 | Contribution score includes reviews, posts, follows | unit | `npx vitest run tests/unit/gamification/contribution-score.test.ts -x` | Wave 0 |

### Sampling Rate
- **Per task commit:** `npx vitest run tests/unit/gamification/ -x`
- **Per wave merge:** `npx vitest run`
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps
- [ ] `tests/unit/gamification/badge-awards.test.ts` -- covers GAME-04 (awardBadge idempotency, trigger conditions)
- [ ] `tests/unit/gamification/leaderboard-queries.test.ts` -- covers GAME-02, GAME-03
- [ ] `tests/unit/gamification/ranking-computation.test.ts` -- covers GAME-01, GAME-06 (formula correctness)
- [ ] `tests/unit/gamification/profile-ranking.test.ts` -- covers GAME-05

## Sources

### Primary (HIGH confidence)
- Existing codebase: `src/lib/db/schema/gamification.ts` -- schema already defined with RLS policies
- Existing codebase: `src/app/(protected)/(profile)/perfil/page.tsx` -- stub functions at lines 36-45
- Existing codebase: `src/app/(protected)/(explore)/explorar/page.tsx` -- tab structure to extend
- Existing codebase: `src/actions/collection.ts`, `community.ts`, `social.ts` -- server actions for badge triggers
- Existing codebase: `src/lib/collection/rarity.ts` -- getRarityTier() for Ultra Rare threshold (>= 2.0)
- Existing codebase: `src/lib/db/seeds/genre-groups.ts` -- genre group seeding pattern
- [Supabase pg_cron Docs](https://supabase.com/docs/guides/database/extensions/pg_cron) -- extension availability and setup
- [Supabase Cron Module](https://supabase.com/docs/guides/cron) -- scheduling interface
- [pg_cron GitHub](https://github.com/citusdata/pg_cron) -- cron.schedule() SQL syntax

### Secondary (MEDIUM confidence)
- [Supabase RLS Bypass Discussion](https://github.com/orgs/supabase/discussions/3563) -- SECURITY DEFINER function runs as owner, bypasses RLS
- [PostgreSQL ln() documentation](https://www.postgresql.org/docs/current/functions-math.html) -- natural logarithm function available in all PostgreSQL versions

### Tertiary (LOW confidence)
- None -- all findings verified against codebase and official docs

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH -- no new dependencies, all existing patterns
- Architecture: HIGH -- pg_cron is well-documented Supabase feature, SQL ranking functions are standard PostgreSQL
- Pitfalls: HIGH -- identified from direct code inspection (missing INSERT policy, import batch optimization, GIN index need)
- Badge system: HIGH -- follows existing admin client pattern (user_badges already has supabaseAuthAdminRole policy)

**Research date:** 2026-03-27
**Valid until:** 2026-04-27 (stable -- no external dependencies changing)
