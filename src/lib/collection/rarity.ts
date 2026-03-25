export type RarityTier = "Ultra Rare" | "Rare" | "Common" | null;

/**
 * Maps a numeric rarity score to a display tier label.
 *
 * Thresholds (per D-12):
 *   >= 2.0  -> "Ultra Rare"
 *   >= 0.5  -> "Rare"
 *   <  0.5  -> "Common"
 *   null    -> null (no badge)
 */
export function getRarityTier(score: number | null): RarityTier {
	if (score === null || score === undefined) return null;
	if (score >= 2.0) return "Ultra Rare";
	if (score >= 0.5) return "Rare";
	return "Common";
}

/**
 * Returns the shadcn Badge variant for a rarity tier.
 */
export function getRarityBadgeVariant(
	tier: RarityTier,
): "destructive" | "default" | "secondary" | "outline" {
	switch (tier) {
		case "Ultra Rare":
			return "destructive";
		case "Rare":
			return "default";
		case "Common":
			return "secondary";
		default:
			return "outline";
	}
}
