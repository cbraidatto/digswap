# Phase 8: Gamification + Rankings — Context

**Gathered:** 2026-03-27
**Status:** Ready for planning

<domain>
## Phase Boundary

Add competitive standing to the platform — global and genre leaderboards, badge awards for milestones, rank titles per tier, and composite score tracking. Replace the profile stub (`getRankTitle()` / `getRankLevel()` based on collection count) with the real formula backed by `user_rankings`, `badges`, and `user_badges` tables already in the DB schema from Phase 1.

Surfaces in scope:
- `/explorar` — gains a `RANKINGS` tab alongside `DIGGERS` and `RECORDS`
- `/perfil` and `/perfil/[username]` — replace stub rank display with real score + title + badges
- Background job — pg_cron recalculates all rankings every 15 minutes
- Badge award triggers — wired into existing server actions (addRecord, createReview, completeTrade, followUser, joinGroup)

Out of scope for Phase 8:
- Redis sorted sets (deferred — add when user volume justifies it)
- Trade-based badges (trades not live until Phase 9 — `CONNECTOR` badge stub only)
- Per-genre rank on profiles (global rank only on profile; genre leaderboards on /explorar)
- Moderation or admin tools for badges

</domain>

<decisions>
## Implementation Decisions

### Ranking Formula

- **D-01:** Global score formula:
  ```
  globalScore = rarityScore × 0.7 + contributionScore × 0.3
  ```
  Coleção-first weighting — rewards diggers with rare collections, not just active posters.

- **D-02:** `rarityScore` aggregation — logarithmic sum across entire collection:
  ```
  rarityScore = SUM(log(1 + release.rarityScore)) for all records in user's collection
  ```
  Rationale: avoids SUM inflation (bulk common records can't game it), avoids AVG unfairness (small curated collection vs large varied one), applies diminishing returns to ultra-rare outliers. Matches VinylRank.com approach validated for Discogs community.

- **D-03:** `contributionScore` point values:
  | Action | Points |
  |--------|--------|
  | Review written (with rating) | +10 |
  | Group post published | +3 |
  | Trade completed | +15 |
  | Following someone | +1 |
  | Receiving a follow | +2 |

- **D-04:** `globalScore` maps to rank title thresholds:
  | Title | Score Range |
  |-------|-------------|
  | `Vinyl Rookie` | 0 – 50 pts |
  | `Crate Digger` | 51 – 200 pts |
  | `Wax Prophet` | 201 – 500 pts |
  | `Record Archaeologist` | 501+ pts |
  These are the same names already in the profile stub — Phase 8 wires them to the real score.

### Leaderboard

- **D-05:** Leaderboard lives as a `RANKINGS` tab inside `/explorar` — alongside the existing `DIGGERS` and `RECORDS` tabs. No separate `/rankings` route.

- **D-06:** Each leaderboard row displays: `#[rank] · [username] · [title] · [score]pts`
  Example: `#1 · wax_prophet · Wax Prophet · 847.3pts`
  No avatar on leaderboard rows (keeps terminal aesthetic clean).

- **D-07:** Two leaderboard scopes: **Global** + **Per genre** (Electronic, Jazz, Hip Hop, Rock, Soul, Latin, Classical — matching auto-generated groups from Phase 7). Genre leaderboard ranks users by `rarityScore` of records in that genre only.

- **D-08:** Navigation between global and genre leaderboards — **Claude's Discretion**. User wants something visually distinctive. Suggested: styled filter mechanism consistent with the retro/analog terminal aesthetic.

### Badges

- **D-09:** Six badges ship in v1:
  | Slug | Name | Trigger |
  |------|------|---------|
  | `first_dig` | `FIRST_DIG` | First Discogs import completed |
  | `century_club` | `CENTURY_CLUB` | 100 records in collection |
  | `rare_find` | `RARE_FIND` | First Ultra Rare record added (rarityScore ≥ 2.0) |
  | `critic` | `CRITIC` | First review written |
  | `connector` | `CONNECTOR` | First trade completed (stub in Phase 8 — awarded in Phase 9) |
  | `crew_member` | `CREW_MEMBER` | First group joined |

- **D-10:** Badges are seeded into the `badges` table via migration. Awarded by server actions calling an `awardBadge(userId, slug)` utility that inserts into `user_badges` (idempotent — no duplicate awards).

- **D-11:** Badge display on profile — shown as a row of badge slugs below the rank title. Visual style: **Claude's Discretion** (terminal/ASCII style consistent with existing design system).

### Rank Update Cadence

- **D-12:** Rankings recalculated via **pg_cron every 15 minutes**. Job queries all users, computes `rarityScore` + `contributionScore`, updates `user_rankings` table with new `globalRank` integers and `title`.

- **D-13:** Redis sorted sets deferred — add when user volume makes 15-min cadence feel stale. pg_cron is sufficient for MVP.

- **D-14:** Genre leaderboards computed in the same pg_cron job — separate query per genre, rank stored or computed on-the-fly at query time (Claude's discretion on storage approach).

### Claude's Discretion

- Genre leaderboard navigation UI (something visually distinctive, consistent with retro terminal aesthetic)
- Badge visual rendering on profile (ASCII/terminal style vs icon — match existing design language)
- Whether genre ranks are stored separately or computed at query time from `collection_items` join
- `CONNECTOR` badge stub — show as locked/greyed until Phase 9 enables trades, or omit entirely until Phase 9
- Leaderboard pagination (cursor-based, consistent with Phase 5/6 pattern)

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Database Schema
- `src/lib/db/schema/gamification.ts` — `userRankings` (rarityScore, contributionScore, globalRank, title), `badges` (slug, name, description), `userBadges` (userId, badgeId, earnedAt). RLS already configured.
- `src/lib/db/schema/collections.ts` — `collectionItems` joined with `releases.rarityScore` for per-user rarity computation
- `src/lib/db/schema/reviews.ts` — source for contribution events (review created)
- `src/lib/db/schema/users.ts` — `profiles` table for display on leaderboard rows

### Profile Stub (to be replaced)
- `src/app/(protected)/(profile)/perfil/page.tsx` — `getRankTitle()` and `getRankLevel()` functions (lines ~40-50) — Phase 8 replaces these with `userRankings` table reads
- XP/level stub variables (`xp`, `xpInLevel`, `xpProgressPct`, `rankTitle`, `rankLevel`) — all to be replaced

### Existing Patterns
- `src/lib/collection/queries.ts` — established pattern for joining `collectionItems` + `releases`
- `src/lib/social/queries.ts` — established pattern for aggregation queries
- `src/app/(protected)/(explore)/explorar/` — existing tab structure (`DIGGERS`, `RECORDS`) to extend with `RANKINGS`

### Project Requirements
- `.planning/REQUIREMENTS.md` §"Gamification + Rankings" — GAME-01 through GAME-06 acceptance criteria
- `.planning/PROJECT.md` §"Gamificação" — rank titles, badge milestones, per-genre leaderboards defined

### External Reference
- VinylRank.com — validated logarithmic rarity scoring for Discogs community (used as design reference)

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `ExplorarPage` tab bar (`DIGGERS` / `RECORDS`) — extend to 3 tabs adding `RANKINGS`
- `collectionFilterSchema` + filter chips pattern (Phase 4) — adapt for genre filter on leaderboard
- Cursor-based pagination (Phase 5/6) — reuse for leaderboard rows
- `getRarityTier()` utility — already maps rarityScore to Common/Rare/Ultra Rare tiers

### Established Patterns
- Server actions in `src/actions/` — badge award triggers wire into existing actions (addRecord, createReview, joinGroup, followUser)
- Supabase pg_cron — already referenced in PROJECT.md stack patterns for scheduled jobs
- Terminal aesthetic: `[TAG]` labels, `·` separators, monospace grid — apply to leaderboard rows and badge slugs

### Integration Points
- `/explorar` page — add `RANKINGS` tab, new `LeaderboardTab` component
- `/perfil` and `/perfil/[username]` — replace stub rank display with `userRankings` query
- `addRecord` server action — trigger `FIRST_DIG`, `CENTURY_CLUB`, `RARE_FIND` badge checks
- `createReview` server action — trigger `CRITIC` badge check
- `joinGroup` server action — trigger `CREW_MEMBER` badge check
- `followUser` server action — update `contributionScore` (+1 for follower, +2 for followed)

</code_context>

<specifics>
## Specific Ideas

- Show rarity signal on profile: why a record moved the score (e.g., `RARITY_SIGNAL: want/have 425:4`) — validated as culturally fitting for Discogs community
- Leaderboard row format locked: `#[N] · [username] · [title] · [score]pts`
- Genre leaderboard ranks by rarity of records in that genre specifically (not global score)
- `CONNECTOR` badge is trade-dependent — stub or defer to Phase 9

</specifics>

<deferred>
## Deferred Ideas

- Redis sorted sets for real-time ranking updates — add in Phase 10/11 when user volume justifies
- Per-genre rank stored on user profile (show "Top 3% in Jazz") — future enhancement
- Monthly/weekly leaderboard periods — future enhancement post-launch
- Badge icons (image assets) — v1 uses ASCII/terminal style slugs

</deferred>

---

*Phase: 08-gamification-rankings*
*Context gathered: 2026-03-27*
