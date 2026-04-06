# Phase 20: Gem Economy - Research

**Researched:** 2026-04-06
**Domain:** Gamification scoring system replacement (database, scoring logic, UI components, notifications)
**Confidence:** HIGH

## Summary

Phase 20 replaces the current 3-tier static rarity system (Common/Rare/Ultra Rare) with a 6-tier dynamic gem economy. The implementation touches every layer of the stack: the scoring formula in `lib/discogs/client.ts`, the display component (`RarityPill` used in 9 files), the ranking SQL function (`recalculate_rankings()` in pg_cron), the profile RankCard, the leaderboard queries, the badge system, and the Digger DNA rarity profile thresholds.

The core data source (`computeRarityScore` which computes want/have ratio) stays unchanged. What changes is how that ratio maps to tiers (6 instead of 3), how collection value is computed (weighted sum of gem values instead of `ln(1 + score)` sum), and how it is displayed (gem badges with visual effects instead of text pills).

**Primary recommendation:** Implement bottom-up: gem tier function and constants first, then database schema migration (add `gem_score` column or repurpose `rarity_score`), then update the ranking SQL function, then replace UI components, then add notifications, then visual effects. The ranking SQL function is the single most critical piece -- it controls how gem scores flow into the leaderboard.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- **Gem Tier Hierarchy:** 6 tiers -- Quartzo (weight 1, <0.3), Ametista (3, 0.3-0.8), Esmeralda (8, 0.8-1.5), Rubi (20, 1.5-3.0), Safira (35, 3.0-6.0), Diamante (100, >=6.0)
- **Dynamic Market Behavior:** Re-compute on every Discogs sync; notify owner on tier change; Gem Score = SUM of gem weights; purely data-driven from Discogs
- **Ranking Replacement:** Global Score = gemScore * 0.7 + contributionScore * 0.3; repurpose/replace `rarity_score` with `gem_score`; update leaderboard and genre MV; adjust RANK_TITLES thresholds
- **Visual Effects:** Quartzo static; Ametista purple glow on hover; Esmeralda green shimmer on hover; Rubi warm pulse on hover; Safira blue glow + sparkle on hover; Diamante prismatic refraction always active + sparkle + rainbow edge glow
- **Gem Vault on Profile:** Distribution visualization, total Gem Score displayed, rarest gem highlighted, replaces current average rarity display
- **Gem names are Portuguese:** Quartzo, Ametista, Esmeralda, Rubi, Safira, Diamante

### Claude's Discretion
- Exact CSS animation keyframes and durations
- Gem icon SVG design (Lucide as base or custom SVGs)
- Gem Vault layout (bar chart vs pie chart vs gem grid)
- Database migration strategy (alter existing column vs new column)
- Whether to show gem trend (up/down arrow since last sync)

### Deferred Ideas (OUT OF SCOPE)
- Gem trading economy (spending gems for premium features)
- Historical gem price chart per record
- "Gem Market" page showing biggest movers
- Gem-based achievements beyond current badges
- Animated gem icons (Lottie or CSS-only) -- start with CSS, upgrade later
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| GEM-01 | Every record displays a gem badge instead of rarity pill | GemBadge component replaces RarityPill in 9 consumer files; getGemTier() replaces getRarityTier() |
| GEM-02 | Gem tier dynamically computed from Discogs have/want ratio | computeRarityScore() unchanged; getGemTier() maps ratio to 6 tiers; import worker continues storing ratio |
| GEM-03 | Gem Score replaces rarity_score in global ranking formula | New recalculate_rankings() SQL uses GEM_WEIGHTS lookup; user_rankings.rarity_score repurposed as gem_score |
| GEM-04 | Profile shows gem distribution (vault/portfolio view) | New GemVault component on AboutTab; query aggregates gem counts per tier from collection |
| GEM-05 | Gem tier changes trigger notifications | Import worker compares pre/post gem tiers per record; creates notification rows for tier changes |
| GEM-06 | Leaderboard ranks by Gem Score | Leaderboard queries updated; genre_leaderboard_mv updated to use gem weights |
| GEM-07 | Higher-tier gems have visual effects | CSS keyframe animations on GemBadge component; Diamante always-active prismatic effect |
</phase_requirements>

## Standard Stack

### Core (no new dependencies)
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Tailwind CSS | 4.2.x (existing) | Gem visual effects animations | CSS keyframes via @keyframes in Tailwind; no JS animation library needed for hover glows and sparkle effects |
| Drizzle ORM | 0.45.x (existing) | Schema migration for gem_score column | Already used for all schema definitions |
| Supabase | Existing | Notification creation for tier changes | Existing notification infrastructure handles new notification type |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| Lucide React | Existing in project | Base gem icons | Use Diamond, Gem icons as starting point for gem badges |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| CSS-only animations | Framer Motion | Framer Motion adds bundle weight; CSS keyframes sufficient for hover effects and prismatic shimmer. Framer only needed if wanting spring physics, which is not required. |
| Inline SVG gem icons | Lottie animations | Lottie is explicitly deferred. CSS + SVG is the approach. |
| Bar chart (gem vault) | Recharts/D3 | Heavy dependency for what is essentially 6 colored bars. CSS flex bars are sufficient and match the app's mono/retro aesthetic. |

**Installation:** No new packages needed. All work uses existing stack.

## Architecture Patterns

### Recommended Project Structure
```
src/
├── lib/
│   ├── gems/
│   │   ├── constants.ts        # GEM_TIERS, GEM_WEIGHTS, getGemTier(), computeGemScore()
│   │   └── queries.ts          # getGemDistribution(), getGemScoreForUser()
│   ├── gamification/
│   │   ├── constants.ts        # UPDATE: computeGlobalScore(gemScore, contributionScore)
│   │   └── queries.ts          # UPDATE: leaderboard queries use gem_score
│   └── collection/
│       └── rarity.ts           # DEPRECATE: getRarityTier, getRarityBadgeVariant (keep for migration safety)
├── components/
│   └── ui/
│       ├── gem-badge.tsx        # New: replaces rarity-pill.tsx
│       └── rarity-pill.tsx      # DEPRECATE: keep file, mark as @deprecated
└── app/
    └── (protected)/(profile)/perfil/_components/
        ├── gem-vault.tsx        # New: distribution visualization
        └── rank-card.tsx        # UPDATE: show gem_score instead of rarity_score
```

### Pattern 1: Gem Tier Classification (Pure Function)
**What:** Map want/have ratio to gem tier
**When to use:** Every place a record's rarity is displayed
**Example:**
```typescript
// src/lib/gems/constants.ts

export type GemTier = 'quartz' | 'amethyst' | 'emerald' | 'ruby' | 'sapphire' | 'diamond';

export const GEM_TIERS = [
  { key: 'quartz',   name: 'Quartzo',   maxRatio: 0.3,  weight: 1,   color: '#9CA3AF' },
  { key: 'amethyst', name: 'Ametista',   maxRatio: 0.8,  weight: 3,   color: '#8B5CF6' },
  { key: 'emerald',  name: 'Esmeralda',  maxRatio: 1.5,  weight: 8,   color: '#10B981' },
  { key: 'ruby',     name: 'Rubi',       maxRatio: 3.0,  weight: 20,  color: '#EF4444' },
  { key: 'sapphire', name: 'Safira',     maxRatio: 6.0,  weight: 35,  color: '#3B82F6' },
  { key: 'diamond',  name: 'Diamante',   maxRatio: Infinity, weight: 100, color: '#F0F9FF' },
] as const;

export function getGemTier(score: number | null): GemTier | null {
  if (score === null || score === undefined) return null;
  if (score < 0.3) return 'quartz';
  if (score < 0.8) return 'amethyst';
  if (score < 1.5) return 'emerald';
  if (score < 3.0) return 'ruby';
  if (score < 6.0) return 'sapphire';
  return 'diamond';
}

export function getGemWeight(tier: GemTier): number {
  const t = GEM_TIERS.find(g => g.key === tier);
  return t?.weight ?? 0;
}

export function getGemInfo(tier: GemTier) {
  return GEM_TIERS.find(g => g.key === tier)!;
}
```

### Pattern 2: Ranking SQL Function Update
**What:** The `recalculate_rankings()` PostgreSQL function must switch from `ln(1 + rarity_score)` sum to weighted gem score sum
**When to use:** pg_cron every 15 minutes
**Example:**
```sql
-- Updated rarity CTE in recalculate_rankings()
WITH gem_scores AS (
  SELECT ci.user_id,
         SUM(
           CASE
             WHEN COALESCE(r.rarity_score, 0) >= 6.0 THEN 100
             WHEN COALESCE(r.rarity_score, 0) >= 3.0 THEN 35
             WHEN COALESCE(r.rarity_score, 0) >= 1.5 THEN 20
             WHEN COALESCE(r.rarity_score, 0) >= 0.8 THEN 8
             WHEN COALESCE(r.rarity_score, 0) >= 0.3 THEN 3
             ELSE 1
           END
         ) AS gem_score
  FROM collection_items ci
  JOIN releases r ON r.id = ci.release_id
  GROUP BY ci.user_id
)
-- Rest of CTE uses gem_score instead of rarity_score
```

### Pattern 3: Gem Tier Change Detection in Import Worker
**What:** Compare pre-sync and post-sync gem tiers for each record to detect transitions
**When to use:** After Discogs sync completes in import worker route
**Example:**
```typescript
// In import worker, after all pages processed:
// 1. Before sync: snapshot current gem tiers for user's collection
// 2. After sync: compute new gem tiers
// 3. Diff and create notifications for tier changes

// Pre-sync snapshot approach (simpler):
// Store {releaseId -> oldRarityScore} before processing
// After processing: compare getGemTier(oldScore) vs getGemTier(newScore)
// Create notifications for any changes
```

### Pattern 4: Gem Vault Component
**What:** Display gem distribution on profile as a visual grid/bar chart
**When to use:** Profile AboutTab, replacing the current rarity score display
**Example:**
```typescript
// Query: count records per gem tier for a user
// SELECT
//   CASE WHEN r.rarity_score >= 6.0 THEN 'diamond'
//        WHEN r.rarity_score >= 3.0 THEN 'sapphire'
//        ... END AS gem_tier,
//   COUNT(*) AS count
// FROM collection_items ci
// JOIN releases r ON r.id = ci.release_id
// WHERE ci.user_id = $1
// GROUP BY gem_tier

// Display as stacked bar or grid of gem icons with counts
```

### Anti-Patterns to Avoid
- **Storing gem tier as a column on releases:** The gem tier is derived from rarity_score (want/have ratio). Storing it creates a denormalization that must be kept in sync. Compute it at query time or in the ranking function.
- **Per-record gem tier change detection during import:** Do NOT check tier changes record-by-record during page processing. This creates N additional queries. Instead, snapshot before sync, batch-compare after sync.
- **Client-side gem score computation:** The gem score must be computed server-side (in PostgreSQL ranking function) to prevent manipulation. Client only displays it.
- **Removing rarity_score column from releases:** The column stores the raw want/have ratio which is the SOURCE data. Gem tier is derived FROM it. Keep it. Only `user_rankings.rarity_score` is semantically replaced.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Prismatic/rainbow CSS effect | WebGL shader | CSS `conic-gradient` + `hue-rotate` animation | Browser-compatible, no WebGL dependency, sufficient for the effect |
| Sparkle particles | Canvas-based particle system | CSS pseudo-elements with randomized animation-delay | Lightweight, composable, matches existing Tailwind approach |
| Gem distribution chart | D3.js or Recharts | CSS flexbox bars with Tailwind classes | 6 bars is trivial; no charting library overhead |
| Gem tier computation at scale | Custom materialized view | PostgreSQL CASE expression in existing `recalculate_rankings()` function | Keeps gem logic centralized in one SQL function |

**Key insight:** This phase is primarily a refactor/replacement, not new infrastructure. The heavy lifting is in the SQL ranking function and the 44-file touch surface for `rarity_score`/`rarityScore` references. The visual effects are CSS-only and relatively simple.

## Common Pitfalls

### Pitfall 1: Breaking the Leaderboard During Migration
**What goes wrong:** Updating the ranking SQL function to use gem scores while the column still holds old rarity scores creates a period where leaderboards show nonsensical data.
**Why it happens:** pg_cron runs every 15 minutes. If you deploy the new SQL function before updating the application code, or vice versa, there is a window of inconsistency.
**How to avoid:** Deploy in this order: (1) Add gem_score column to user_rankings if using new column, (2) Update the SQL function to write to BOTH columns, (3) Deploy app code that reads gem_score, (4) Remove old column reads. Or simpler: repurpose the existing `rarity_score` column since the formula output is the same type (float).
**Warning signs:** Leaderboard shows all users with score 0 or wildly different rankings.

### Pitfall 2: Notification Flood on First Gem Sync
**What goes wrong:** When the gem system goes live, every user's next sync triggers tier change notifications for their ENTIRE collection (because going from no-gem to a-gem is a "change").
**Why it happens:** There is no previous gem tier data to compare against.
**How to avoid:** On the first deployment, run a one-time backfill that sets "initial" gem tiers without generating notifications. Only subsequent syncs should trigger notifications.
**Warning signs:** Users receiving 500+ notifications on first sync.

### Pitfall 3: 44-File Touch Surface for rarity_score
**What goes wrong:** Missing one file that references `rarity_score` or `getRarityTier()` causes runtime errors or displays stale rarity pills.
**Why it happens:** The rarity system is deeply embedded across queries, components, and server actions.
**How to avoid:** Use the complete file list from grep (provided in this research). Create a checklist. The replacement is mechanical but must be exhaustive.
**Warning signs:** TypeScript compilation errors for removed functions, or stale "Ultra Rare" pills appearing alongside new gem badges.

### Pitfall 4: Genre Leaderboard MV Not Updated
**What goes wrong:** Global leaderboard uses gem scores but genre leaderboard still uses old `rarity_score` formula.
**Why it happens:** The `genre_leaderboard_mv` materialized view has its own SQL definition separate from the ranking function. Easy to forget.
**How to avoid:** Update the MV definition alongside the ranking function. Both must use the same gem weight CASE expression.
**Warning signs:** Genre leaderboard rankings diverge from global rankings for the same users.

### Pitfall 5: OG Image Route Breaks
**What goes wrong:** The OG rarity card at `/api/og/rarity/[username]` references "ultra rare" count and average rarity in its HMAC signature.
**Why it happens:** The OG route runs on Edge runtime with its own data flow (query params signed with HMAC).
**How to avoid:** Update the OG image to show gem distribution or total gem score. Update the HMAC signature payload to match new data fields.
**Warning signs:** OG images show "0 Ultra Rare" or fail HMAC verification.

### Pitfall 6: Digger DNA Rarity Profile Thresholds
**What goes wrong:** The `computeDiggerDna` function in `engagement.ts` uses `avgRarity` with thresholds at 25/50/75 to classify users as "mainstream_maven", "balanced_digger", "deep_cutter", "ultra_rare_hunter". These thresholds are calibrated to the old rarity_score scale.
**Why it happens:** avgRarity is the mean of all rarity_scores in a collection. With gem weights (1-100), the average changes dramatically.
**How to avoid:** Decide whether Digger DNA should use gem weights or raw ratios. If gem weights: recalibrate thresholds. If raw ratios: keep existing code, but rename labels to match gem terminology.
**Warning signs:** All users classified as the same rarity profile after gem migration.

## Code Examples

### Gem Badge Component (replaces RarityPill)
```tsx
// src/components/ui/gem-badge.tsx
import { getGemInfo, getGemTier, type GemTier } from "@/lib/gems/constants";

interface GemBadgeProps {
  score: number | null | undefined;
  showScore?: boolean;
  className?: string;
}

export function GemBadge({ score, showScore = false, className = "" }: GemBadgeProps) {
  const tier = getGemTier(score ?? null);
  if (!tier) return null;
  const info = getGemInfo(tier);

  return (
    <span
      className={`inline-flex items-center gap-1 font-mono text-[10px] font-semibold px-2 py-0.5 rounded-full border whitespace-nowrap ${getGemStyle(tier)} ${className}`}
    >
      <GemIcon tier={tier} size={12} />
      {info.name}
      {showScore && score != null && (
        <span className="opacity-70">x{info.weight}</span>
      )}
    </span>
  );
}
```

### CSS Keyframes for Gem Effects
```css
/* Diamante - prismatic refraction (always active) */
@keyframes prismatic {
  0% { filter: hue-rotate(0deg) brightness(1.1); }
  50% { filter: hue-rotate(180deg) brightness(1.3); }
  100% { filter: hue-rotate(360deg) brightness(1.1); }
}

/* Safira - sparkle particles on hover */
@keyframes sparkle {
  0%, 100% { opacity: 0; transform: scale(0) rotate(0deg); }
  50% { opacity: 1; transform: scale(1) rotate(180deg); }
}

/* Rubi - warm pulse on hover */
@keyframes warm-pulse {
  0%, 100% { box-shadow: 0 0 4px rgba(239, 68, 68, 0.3); }
  50% { box-shadow: 0 0 12px rgba(239, 68, 68, 0.6); }
}

/* Esmeralda - green shimmer on hover */
@keyframes shimmer {
  0% { background-position: -200% center; }
  100% { background-position: 200% center; }
}
```

### Updated Ranking SQL Function
```sql
-- Replace the rarity CTE in recalculate_rankings()
rarity AS (
  SELECT ci.user_id,
         SUM(
           CASE
             WHEN COALESCE(r.rarity_score, 0) >= 6.0 THEN 100  -- Diamante
             WHEN COALESCE(r.rarity_score, 0) >= 3.0 THEN 35   -- Safira
             WHEN COALESCE(r.rarity_score, 0) >= 1.5 THEN 20   -- Rubi
             WHEN COALESCE(r.rarity_score, 0) >= 0.8 THEN 8    -- Esmeralda
             WHEN COALESCE(r.rarity_score, 0) >= 0.3 THEN 3    -- Ametista
             ELSE 1                                              -- Quartzo
           END
         ) AS rarity_score  -- Still named rarity_score in CTE for minimal change
  FROM collection_items ci
  JOIN releases r ON r.id = ci.release_id
  GROUP BY ci.user_id
)
```

## Codebase Touch Surface (Exhaustive)

### Files referencing getRarityTier / getRarityBadgeVariant (MUST update)
1. `components/ui/rarity-pill.tsx` -- Replace with gem-badge.tsx
2. `app/(protected)/(profile)/perfil/_components/collection-card.tsx`
3. `app/(protected)/(feed)/feed/_components/feed-card.tsx`
4. `lib/wantlist/radar-queries.ts`
5. `lib/collection/rarity.ts` -- Source; deprecate
6. `app/release/[discogsId]/_components/release-hero.tsx`
7. `app/(protected)/(profile)/perfil/[username]/compare/page.tsx`
8. `app/(protected)/(explore)/explorar/_components/record-search-card.tsx`

### Files referencing RarityPill import (MUST update)
1. `app/(protected)/(profile)/perfil/_components/wantlist-match-section.tsx`
2. `app/(protected)/(profile)/perfil/_components/collection-card.tsx`
3. `app/(protected)/(feed)/feed/_components/group-feed-card.tsx`
4. `app/release/[discogsId]/_components/similar-section.tsx`
5. `app/(protected)/(profile)/perfil/_components/wantlist-card.tsx`
6. `app/(protected)/(explore)/explorar/_components/suggested-section.tsx`
7. `app/(protected)/(explore)/explorar/_components/trending-section.tsx`
8. `app/(protected)/(explore)/explorar/_components/browse-grid.tsx`

### Files referencing rarity_score / rarityScore (44 total; key ones to update)
- **Schema:** `lib/db/schema/releases.ts` (KEEP column), `lib/db/schema/gamification.ts` (repurpose label)
- **Queries:** `lib/gamification/queries.ts`, `lib/gamification/constants.ts`, `lib/collection/queries.ts`
- **Import:** `lib/discogs/import-worker.ts`, `lib/discogs/client.ts` (KEEP computeRarityScore)
- **Actions:** `actions/collection.ts`, `actions/wantlist.ts`, `actions/engagement.ts`, `actions/wrapped.ts`, `actions/export.ts`, `actions/search.ts`
- **Pages/Components:** 20+ page/component files (the full list is in grep output above)
- **SQL:** `supabase/migrations/20260327_ranking_function.sql`

### Profile components to update
- `perfil/_components/rank-card.tsx` -- Show gem_score label instead of "Rarity"
- `perfil/_components/about-tab.tsx` -- Add GemVault, update stats grid
- `perfil/page.tsx` -- Pass gem distribution data
- `api/og/rarity/[username]/route.tsx` -- Update OG image

### Gamification constants to update
- `RANK_TITLES` thresholds -- Must recalibrate for gem score scale
- `computeGlobalScore` -- Parameter name change (gemScore instead of rarityScore)
- `BADGE_DEFINITIONS` rare_find -- Update threshold from "rarity >= 2.0" to "Safira or Diamante"
- Badge award in import worker -- Update `gte("releases.rarity_score", 2.0)` to gem-tier-based check

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| 3-tier text pill (Common/Rare/Ultra Rare) | 6-tier gem badge with visual effects | Phase 20 | Every record display surface changes |
| `ln(1 + rarity_score)` sum for ranking | Weighted gem score sum (1/3/8/20/35/100) | Phase 20 | Rankings will shift significantly -- exponential weight curve makes high-tier gems dominant |
| rarity_score * 0.7 in global formula | gemScore * 0.7 in global formula | Phase 20 | Same weight, different input scale |

**Scale impact analysis:** A user with 500 records all at Quartzo (weight 1) gets gem_score = 500. A user with 100 records including 5 Diamante (weight 100) gets at minimum 500 + 95*1 = 595. The exponential curve means even a few high-tier gems dramatically shift rankings. This is the intended "stock market" behavior.

## Open Questions

1. **RANK_TITLES thresholds for gem score scale**
   - What we know: Current thresholds are 0/51/201/501 calibrated to `ln(1+score)` sum
   - What's unclear: What gem score values correspond to typical collections of 100/500/1000 records
   - Recommendation: Calculate expected gem scores for typical collections to set new thresholds. A 200-record collection with typical distribution might be: ~100 Quartzo (100), ~50 Ametista (150), ~30 Esmeralda (240), ~15 Rubi (300), ~4 Safira (140), ~1 Diamante (100) = ~1030. Set thresholds accordingly (e.g., 100/500/2000/5000).

2. **Whether to show gem trend arrows**
   - What we know: Claude's discretion area; the data is available (old vs new rarity_score)
   - What's unclear: Whether the UI complexity is worth it for v1
   - Recommendation: Skip for initial implementation. Add as a fast-follow if users request it. The notification system already communicates tier changes.

3. **Digger DNA rarity profile recalibration**
   - What we know: Current thresholds use avgRarity (mean of want/have ratios): 25/50/75
   - What's unclear: Whether to recalibrate to gem weights or keep using raw ratios
   - Recommendation: Keep Digger DNA using raw ratios (the existing computeRarityScore values). Only rename profile labels to match gem language (e.g., "mainstream_maven" -> "quartz_collector"). This avoids threshold recalibration.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest (existing) |
| Config file | `apps/web/vitest.config.ts` |
| Quick run command | `cd apps/web && npx vitest run tests/unit/gamification --reporter=verbose` |
| Full suite command | `cd apps/web && npx vitest run --reporter=verbose` |

### Phase Requirements -> Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| GEM-01 | getGemTier maps ratio to correct tier | unit | `npx vitest run tests/unit/gems/gem-tiers.test.ts -x` | No -- Wave 0 |
| GEM-02 | computeRarityScore unchanged; getGemTier derives correct tier | unit | `npx vitest run tests/unit/gems/gem-tiers.test.ts -x` | No -- Wave 0 |
| GEM-03 | computeGlobalScore uses gemScore * 0.7 + contribution * 0.3 | unit | `npx vitest run tests/unit/gamification/ranking-computation.test.ts -x` | Yes -- needs update |
| GEM-04 | Gem distribution query returns correct counts per tier | unit | `npx vitest run tests/unit/gems/gem-distribution.test.ts -x` | No -- Wave 0 |
| GEM-05 | Tier change detection produces correct notifications | unit | `npx vitest run tests/unit/gems/gem-notifications.test.ts -x` | No -- Wave 0 |
| GEM-06 | Leaderboard query orders by gem_score | unit | `npx vitest run tests/unit/gamification/ranking-computation.test.ts -x` | Yes -- needs update |
| GEM-07 | GemBadge renders correct CSS classes per tier | unit | `npx vitest run tests/unit/gems/gem-badge.test.tsx -x` | No -- Wave 0 |

### Sampling Rate
- **Per task commit:** `cd apps/web && npx vitest run tests/unit/gems --reporter=verbose`
- **Per wave merge:** `cd apps/web && npx vitest run --reporter=verbose`
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps
- [ ] `tests/unit/gems/gem-tiers.test.ts` -- covers GEM-01, GEM-02 (getGemTier, getGemWeight, GEM_TIERS constants)
- [ ] `tests/unit/gems/gem-distribution.test.ts` -- covers GEM-04 (gem count aggregation logic)
- [ ] `tests/unit/gems/gem-notifications.test.ts` -- covers GEM-05 (tier change detection logic)
- [ ] `tests/unit/gems/gem-badge.test.tsx` -- covers GEM-07 (component renders correct classes)
- [ ] Update `tests/unit/gamification/ranking-computation.test.ts` -- covers GEM-03, GEM-06 (updated constants and formula)

## Sources

### Primary (HIGH confidence)
- Codebase analysis: `apps/web/src/lib/collection/rarity.ts` -- current 3-tier system
- Codebase analysis: `apps/web/src/lib/gamification/constants.ts` -- RANK_TITLES, computeGlobalScore, BADGE_DEFINITIONS
- Codebase analysis: `apps/web/src/lib/gamification/queries.ts` -- leaderboard queries with rarity_score * 0.7
- Codebase analysis: `apps/web/src/lib/discogs/client.ts` -- computeRarityScore formula (want/have ratio)
- Codebase analysis: `apps/web/src/lib/discogs/import-worker.ts` -- import pipeline with badge triggers
- Codebase analysis: `apps/web/src/app/api/discogs/import/route.ts` -- import worker route with post-import badge checks
- Codebase analysis: `supabase/migrations/20260327_ranking_function.sql` -- pg_cron ranking function
- Codebase analysis: `apps/web/src/lib/db/schema/gamification.ts` -- user_rankings schema
- Codebase analysis: `apps/web/src/lib/db/schema/releases.ts` -- releases schema with rarity_score column
- Codebase analysis: `apps/web/src/lib/db/schema/notifications.ts` -- notification schema and preferences
- Codebase analysis: grep for `RarityPill` (9 files), `getRarityTier` (8 files), `rarity_score` (44 files)

### Secondary (MEDIUM confidence)
- CSS animation patterns for gem/crystal effects are well-documented in MDN and CSS-Tricks; `conic-gradient` + `hue-rotate` is the standard prismatic approach

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH -- no new dependencies, all existing stack
- Architecture: HIGH -- pure refactor with clear boundaries (function signatures, SQL, components)
- Pitfalls: HIGH -- identified from direct codebase analysis of all 44 affected files
- Visual effects: MEDIUM -- CSS animation specifics will need iteration but approach is sound

**Research date:** 2026-04-06
**Valid until:** 2026-05-06 (stable -- no external dependency changes expected)
