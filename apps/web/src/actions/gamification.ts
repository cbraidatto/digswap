"use server";

import { requireUser } from "@/lib/auth/require-user";
import {
	getGenreLeaderboard,
	getGenreLeaderboardCount,
	getGlobalLeaderboard,
	getLeaderboardCount,
	type LeaderboardEntry,
} from "@/lib/gamification/queries";
import { apiRateLimit, safeLimit } from "@/lib/rate-limit";
import { genreLeaderboardSchema, leaderboardPageSchema } from "@/lib/validations/gamification";

// ---------------------------------------------------------------------------
// Leaderboard server actions
// ---------------------------------------------------------------------------

export async function loadGlobalLeaderboard(page?: number): Promise<LeaderboardEntry[]> {
	try {
		const parsed = leaderboardPageSchema.safeParse({ page });
		if (!parsed.success) {
			return [];
		}

		const user = await requireUser();

		const { success: rlSuccess } = await safeLimit(apiRateLimit, user.id, false);
		if (!rlSuccess) {
			return [];
		}

		return getGlobalLeaderboard(parsed.data.page);
	} catch (err) {
		console.error("[loadGlobalLeaderboard] error:", err);
		return [];
	}
}

export async function loadGenreLeaderboard(
	genre: string,
	page?: number,
): Promise<LeaderboardEntry[]> {
	try {
		const parsed = genreLeaderboardSchema.safeParse({ genre, page });
		if (!parsed.success) {
			return [];
		}

		const user = await requireUser();

		const { success: rlSuccess } = await safeLimit(apiRateLimit, user.id, false);
		if (!rlSuccess) {
			return [];
		}

		return getGenreLeaderboard(parsed.data.genre, parsed.data.page);
	} catch (err) {
		console.error("[loadGenreLeaderboard] error:", err);
		return [];
	}
}

export async function loadLeaderboardCount(): Promise<number> {
	try {
		const user = await requireUser();

		const { success: rlSuccess } = await safeLimit(apiRateLimit, user.id, false);
		if (!rlSuccess) {
			return 0;
		}

		return getLeaderboardCount();
	} catch (err) {
		console.error("[loadLeaderboardCount] error:", err);
		return 0;
	}
}

export async function loadGenreLeaderboardCount(genre: string): Promise<number> {
	try {
		const parsed = genreLeaderboardSchema.safeParse({ genre });
		if (!parsed.success) {
			return 0;
		}

		const user = await requireUser();

		const { success: rlSuccess } = await safeLimit(apiRateLimit, user.id, false);
		if (!rlSuccess) {
			return 0;
		}

		return getGenreLeaderboardCount(parsed.data.genre);
	} catch (err) {
		console.error("[loadGenreLeaderboardCount] error:", err);
		return 0;
	}
}
