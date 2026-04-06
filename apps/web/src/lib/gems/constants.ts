/**
 * Gem Economy — Tier Definitions and Classification
 *
 * Replaces the 3-tier rarity system (Common/Rare/Ultra Rare) with a
 * 6-tier gem economy based on Discogs want/have ratio.
 *
 * Gem tiers are LOCKED — see 20-CONTEXT.md for rationale.
 */

export type GemTier =
  | "quartz"
  | "amethyst"
  | "emerald"
  | "ruby"
  | "sapphire"
  | "diamond";

export const GEM_TIERS = [
  {
    key: "quartz" as const,
    name: "Quartzo",
    maxRatio: 0.3,
    weight: 1,
    color: "#9CA3AF",
  },
  {
    key: "amethyst" as const,
    name: "Ametista",
    maxRatio: 0.8,
    weight: 3,
    color: "#8B5CF6",
  },
  {
    key: "emerald" as const,
    name: "Esmeralda",
    maxRatio: 1.5,
    weight: 8,
    color: "#10B981",
  },
  {
    key: "ruby" as const,
    name: "Rubi",
    maxRatio: 3.0,
    weight: 20,
    color: "#EF4444",
  },
  {
    key: "sapphire" as const,
    name: "Safira",
    maxRatio: 6.0,
    weight: 35,
    color: "#3B82F6",
  },
  {
    key: "diamond" as const,
    name: "Diamante",
    maxRatio: Infinity,
    weight: 100,
    color: "#F0F9FF",
  },
] as const;

/**
 * Maps a want/have ratio score to a gem tier.
 *
 * Thresholds:
 *   < 0.3  -> quartz
 *   < 0.8  -> amethyst
 *   < 1.5  -> emerald
 *   < 3.0  -> ruby
 *   < 6.0  -> sapphire
 *   >= 6.0 -> diamond
 *   null/undefined -> null
 */
export function getGemTier(score: number | null): GemTier | null {
  if (score === null || score === undefined) return null;
  if (score < 0.3) return "quartz";
  if (score < 0.8) return "amethyst";
  if (score < 1.5) return "emerald";
  if (score < 3.0) return "ruby";
  if (score < 6.0) return "sapphire";
  return "diamond";
}

/**
 * Returns the weight multiplier for a gem tier.
 * Weights follow an exponential curve: 1, 3, 8, 20, 35, 100.
 */
export function getGemWeight(tier: GemTier): number {
  const t = GEM_TIERS.find((g) => g.key === tier);
  return t?.weight ?? 0;
}

/**
 * Returns the full tier configuration object for a gem tier.
 */
export function getGemInfo(tier: GemTier) {
  return GEM_TIERS.find((g) => g.key === tier)!;
}

/**
 * Computes total gem score from an array of rarity_score values.
 * Each score is classified into a gem tier, and the corresponding
 * weight is summed.
 */
export function computeGemScore(scores: number[]): number {
  return scores.reduce((sum, score) => {
    const tier = getGemTier(score);
    if (!tier) return sum;
    return sum + getGemWeight(tier);
  }, 0);
}
