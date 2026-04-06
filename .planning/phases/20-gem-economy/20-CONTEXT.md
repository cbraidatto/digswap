# Phase 20: Gem Economy - Context

**Gathered:** 2026-04-06
**Status:** Ready for planning
**Source:** Direct discussion with developer

<domain>
## Phase Boundary

Replace the current static 3-tier rarity system (Common/Rare/Ultra Rare) with a dynamic 6-tier gem economy. Each record is classified as a gem type based on its Discogs want/have ratio. Gems fluctuate like a stock market -- when supply/demand changes on Discogs re-sync, gem tiers update automatically. The Gem Score replaces rarity_score entirely in global rankings.

**What changes:**
- `getRarityTier()` -> `getGemTier()` (6 tiers instead of 3)
- `rarity_score` in ranking formula -> `gem_score` (weighted sum of gem values)
- Rarity pill component -> Gem badge component with visual effects
- Profile rarity display -> Gem Vault (distribution visualization)
- Leaderboard scoring -> Gem Score based
- Notifications on gem tier transitions

**What stays:**
- Discogs have/want as the data source (computeRarityScore formula unchanged)
- Contribution score (30% of global score)
- Badge system (but RARE_FIND badge threshold updates to Safira/Diamante)
- Digger DNA profiles (update thresholds to match gem tiers)

</domain>

<decisions>
## Implementation Decisions

### Gem Tier Hierarchy (LOCKED)
6 tiers mapped to want/have ratio ranges:

| Gem | Key | Score Range | Weight | Color | Icon |
|-----|-----|------------|--------|-------|------|
| Quartzo | `quartz` | < 0.3 | 1 | Gray/white (#9CA3AF) | Quartz crystal |
| Ametista | `amethyst` | 0.3 - 0.8 | 3 | Purple (#8B5CF6) | Amethyst gem |
| Esmeralda | `emerald` | 0.8 - 1.5 | 8 | Green (#10B981) | Emerald gem |
| Rubi | `ruby` | 1.5 - 3.0 | 20 | Red (#EF4444) | Ruby gem |
| Safira | `sapphire` | 3.0 - 6.0 | 35 | Blue royal (#3B82F6) | Sapphire gem |
| Diamante | `diamond` | >= 6.0 | 100 | White prismatic (#F0F9FF) | Diamond with refraction |

### Dynamic Market Behavior (LOCKED)
- Gem tiers re-compute on every Discogs sync (existing import worker already updates have/want)
- When a record's gem tier changes, a notification is created for the owner
- Gem Score = SUM of gem weights across entire collection
- No manual override -- gems are purely data-driven from Discogs market

### Ranking Replacement (LOCKED)
- Global Score formula changes: `gemScore * 0.7 + contributionScore * 0.3`
- `user_rankings.rarity_score` column repurposed or replaced with `gem_score`
- Leaderboard queries updated to use gem_score
- Genre leaderboard materialized view updated with gem weights
- RANK_TITLES thresholds adjusted for gem score scale

### Visual Effects (LOCKED)
- Quartzo: static, no effects
- Ametista: subtle purple glow on hover
- Esmeralda: green shimmer on hover
- Rubi: warm pulse animation on hover
- Safira: blue glow + sparkle particles on hover
- Diamante: prismatic refraction animation (always active), sparkle particles, rainbow edge glow

### Gem Vault on Profile (LOCKED)
- Shows distribution of gems in collection (bar chart or gem grid)
- Total Gem Score prominently displayed
- Rarest gem highlighted
- Replaces current average rarity display

### Claude's Discretion
- Exact CSS animation keyframes and durations
- Gem icon SVG design (can use Lucide icons as base or custom SVGs)
- Gem Vault layout (bar chart vs pie chart vs gem grid)
- Database migration strategy (alter vs new column)
- Whether to show gem trend (up/down arrow since last sync)

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Rarity System (being replaced)
- `apps/web/src/lib/collection/rarity.ts` -- Current 3-tier system (getRarityTier, getRarityBadgeVariant)
- `apps/web/src/lib/discogs/client.ts` -- computeRarityScore formula (want/have ratio) -- KEEP THIS
- `apps/web/src/components/ui/rarity-pill.tsx` -- Current rarity display component (replace with gem badge)

### Gamification System (being modified)
- `apps/web/src/lib/gamification/constants.ts` -- RANK_TITLES, CONTRIBUTION_POINTS, computeGlobalScore, BADGE_DEFINITIONS
- `apps/web/src/lib/gamification/queries.ts` -- Leaderboard queries (update scoring)
- `apps/web/src/lib/db/schema/gamification.ts` -- user_rankings, badges schema

### Profile & Display (being updated)
- `apps/web/src/actions/engagement.ts` -- Digger DNA computation (update thresholds)
- `apps/web/src/lib/db/schema/engagement.ts` -- digger_dna schema

### Import Pipeline (hook point for notifications)
- `apps/web/src/app/api/discogs/import/route.ts` -- Import route that orchestrates sync jobs (pre/post snapshot hook point)
- `apps/web/src/lib/discogs/import-worker.ts` -- Worker that processes individual pages and updates rarity_score on releases

</canonical_refs>

<specifics>
## Specific Ideas

- Gem names are in Portuguese (Quartzo, Ametista, Esmeralda, Rubi, Safira, Diamante) matching the app's Portuguese navigation
- The "stock market" analogy means: every re-sync is like a market update -- your portfolio (gem collection) value can go up or down
- Diamante records should feel truly special -- they should be rare enough that most users have 0-2 in their entire collection
- The weight curve is exponential (1, 3, 8, 20, 35, 100) to make higher gems dramatically more valuable
- Consider a "Gem Hunt" activity feed event when someone discovers a new Diamante

</specifics>

<deferred>
## Deferred Ideas

- Gem trading economy (spending gems for premium features) -- potential future monetization angle
- Historical gem price chart per record (showing tier changes over time)
- "Gem Market" page showing biggest movers (records that changed tier recently)
- Gem-based achievements beyond current badges
- Animated gem icons (Lottie or CSS-only) -- start with CSS, upgrade later if needed

</deferred>

---

*Phase: 20-gem-economy*
*Context gathered: 2026-04-06 via direct discussion*
