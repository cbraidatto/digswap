/**
 * Gamification constants: rank titles, contribution point values, badge definitions.
 *
 * These are the source-of-truth values for the gamification system.
 * All scoring, ranking, and badge logic derives from these constants.
 *
 * References: D-01 (rank titles), D-03 (contribution points),
 * D-04 (global score formula), D-09 (badge definitions).
 */

// ---------------------------------------------------------------------------
// Contribution Points
// ---------------------------------------------------------------------------

/**
 * Point values awarded for each type of community contribution.
 * Used to compute a user's contributionScore.
 */
export const CONTRIBUTION_POINTS = {
	review_written: 10,
	group_post: 3,
	trade_completed: 15,
	following_someone: 1,
	receiving_follow: 2,
} as const;

// ---------------------------------------------------------------------------
// Rank Titles
// ---------------------------------------------------------------------------

/**
 * Rank title tiers in ascending score order.
 * A user's title is determined by their globalScore (rarity * 0.7 + contribution * 0.3).
 */
export const RANK_TITLES = [
	{ title: "Vinyl Rookie", minScore: 0 },
	{ title: "Crate Digger", minScore: 501 },
	{ title: "Wax Prophet", minScore: 2001 },
	{ title: "Record Archaeologist", minScore: 5001 },
] as const;

/**
 * Returns the rank title for a given global score.
 * Iterates RANK_TITLES in reverse to find the highest tier the score qualifies for.
 */
export function getRankTitleFromScore(score: number): string {
	for (let i = RANK_TITLES.length - 1; i >= 0; i--) {
		if (score >= RANK_TITLES[i].minScore) {
			return RANK_TITLES[i].title;
		}
	}
	return RANK_TITLES[0].title;
}

// ---------------------------------------------------------------------------
// Global Score Formula
// ---------------------------------------------------------------------------

/**
 * Computes the global score from gem-weighted rarity and contribution scores.
 * Formula: gemScore * 0.7 + contributionScore * 0.3
 *
 * @param gemScore - Sum of gem weights for all records in user's collection
 *   (Diamante=100, Safira=35, Esmeralda=20, Rubi=8, Ambar=3, Quartzo=1)
 * @param contributionScore - Sum of community contribution points
 */
export function computeGlobalScore(gemScore: number, contributionScore: number): number {
	return gemScore * 0.7 + contributionScore * 0.3;
}

// ---------------------------------------------------------------------------
// Badge Definitions
// ---------------------------------------------------------------------------

/**
 * The 6 milestone badges available in v1.
 * These are seeded into the badges table and referenced by slug.
 */
export const BADGE_DEFINITIONS = [
	{
		slug: "first_dig",
		name: "FIRST_DIG",
		description: "Completed your first Discogs import",
	},
	{
		slug: "century_club",
		name: "CENTURY_CLUB",
		description: "100 records in your collection",
	},
	{
		slug: "rare_find",
		name: "RARE_FIND",
		description: "Added a Safira or Diamante gem to your collection",
	},
	{
		slug: "critic",
		name: "CRITIC",
		description: "Wrote your first review",
	},
	{
		slug: "connector",
		name: "CONNECTOR",
		description: "Completed your first trade",
	},
	{
		slug: "crew_member",
		name: "CREW_MEMBER",
		description: "Joined your first community group",
	},
] as const;
