import "server-only";

import { sql } from "drizzle-orm";
import { db } from "@/lib/db";
import type { GemTier } from "./constants";

/**
 * Returns the gem distribution (count per tier) for a user's collection.
 *
 * Uses SQL CASE expression to classify each record's rarity_score into
 * gem tiers at query time — avoids storing derived tier data.
 */
export async function getGemDistribution(
  userId: string,
): Promise<Record<GemTier, number>> {
  const rows = await db.execute(sql`
    SELECT
      CASE
        WHEN COALESCE(r.rarity_score, 0) >= 6.0 THEN 'diamond'
        WHEN COALESCE(r.rarity_score, 0) >= 3.0 THEN 'sapphire'
        WHEN COALESCE(r.rarity_score, 0) >= 1.5 THEN 'ruby'
        WHEN COALESCE(r.rarity_score, 0) >= 0.8 THEN 'emerald'
        WHEN COALESCE(r.rarity_score, 0) >= 0.3 THEN 'amethyst'
        ELSE 'quartz'
      END AS gem_tier,
      COUNT(*)::text AS count
    FROM collection_items ci
    JOIN releases r ON r.id = ci.release_id
    WHERE ci.user_id = ${userId}
    GROUP BY gem_tier
  `);

  // Start with all tiers at 0
  const distribution: Record<GemTier, number> = {
    quartz: 0,
    amethyst: 0,
    emerald: 0,
    ruby: 0,
    sapphire: 0,
    diamond: 0,
  };

  // Fill in counts from query results
  for (const row of rows as unknown as Array<{ gem_tier: string; count: string }>) {
    const tier = row.gem_tier as GemTier;
    if (tier in distribution) {
      distribution[tier] = parseInt(row.count, 10) || 0;
    }
  }

  return distribution;
}

/**
 * Returns the total gem score for a user.
 *
 * Gem score = SUM of gem weights across entire collection.
 * Uses the same CASE expression thresholds as getGemDistribution.
 */
export async function getGemScoreForUser(userId: string): Promise<number> {
  const rows = await db.execute(sql`
    SELECT
      SUM(
        CASE
          WHEN COALESCE(r.rarity_score, 0) >= 6.0 THEN 100
          WHEN COALESCE(r.rarity_score, 0) >= 3.0 THEN 35
          WHEN COALESCE(r.rarity_score, 0) >= 1.5 THEN 20
          WHEN COALESCE(r.rarity_score, 0) >= 0.8 THEN 8
          WHEN COALESCE(r.rarity_score, 0) >= 0.3 THEN 3
          ELSE 1
        END
      )::text AS gem_score
    FROM collection_items ci
    JOIN releases r ON r.id = ci.release_id
    WHERE ci.user_id = ${userId}
  `);

  const result = rows as unknown as Array<{ gem_score: string | null }>;
  if (!result.length || !result[0].gem_score) return 0;
  return parseInt(result[0].gem_score, 10) || 0;
}
