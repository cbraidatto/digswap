"use server";

import { createClient } from "@/lib/supabase/server";
import { apiRateLimit , safeLimit} from "@/lib/rate-limit";
import {
	getGlobalLeaderboard,
	getGenreLeaderboard,
	getLeaderboardCount,
	getGenreLeaderboardCount,
	type LeaderboardEntry,
} from "@/lib/gamification/queries";
import { leaderboardPageSchema, genreLeaderboardSchema } from "@/lib/validations/gamification";

// ---------------------------------------------------------------------------
// Auth helper
// ---------------------------------------------------------------------------

async function requireUser() {
	const supabase = await createClient();
	const {
		data: { user },
	} = await supabase.auth.getUser();

	if (!user) {
		throw new Error("Not authenticated");
	}

	return user;
}

// ---------------------------------------------------------------------------
// Leaderboard server actions
// ---------------------------------------------------------------------------

export async function loadGlobalLeaderboard(
	page?: number,
): Promise<LeaderboardEntry[]> {
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

export async function loadGenreLeaderboardCount(
	genre: string,
): Promise<number> {
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
