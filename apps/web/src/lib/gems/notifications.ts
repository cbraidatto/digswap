import { type GemTier, getGemTier, getGemWeight } from "./constants";

/**
 * Describes a single gem tier change for a release.
 */
export interface GemTierChange {
	releaseId: string;
	releaseTitle: string;
	discogsId: number | null;
	oldTier: GemTier;
	newTier: GemTier;
	oldWeight: number;
	newWeight: number;
}

/**
 * Pure function: compares pre-import and post-import rarity scores
 * and returns which records changed gem tier.
 *
 * Design decisions:
 * - Records that exist in newScores but NOT in oldScores are SKIPPED
 *   (prevents notification flood on first import — RESEARCH.md Pitfall 2).
 * - Only records that appear in BOTH maps are compared.
 * - No side effects, no database access.
 */
export function detectGemTierChanges(
	oldScores: Map<string, { score: number; title: string; discogsId: number | null }>,
	newScores: Map<string, { score: number; title: string; discogsId: number | null }>,
): GemTierChange[] {
	const changes: GemTierChange[] = [];

	for (const [releaseId, newEntry] of newScores) {
		const oldEntry = oldScores.get(releaseId);

		// Skip new records (not in old snapshot) — prevents first-sync flood
		if (!oldEntry) continue;

		const oldTier = getGemTier(oldEntry.score);
		const newTier = getGemTier(newEntry.score);

		// Skip if either tier is null (shouldn't happen with valid scores)
		if (!oldTier || !newTier) continue;

		// Skip if tier didn't change
		if (oldTier === newTier) continue;

		changes.push({
			releaseId,
			releaseTitle: newEntry.title,
			discogsId: newEntry.discogsId,
			oldTier,
			newTier,
			oldWeight: getGemWeight(oldTier),
			newWeight: getGemWeight(newTier),
		});
	}

	return changes;
}
