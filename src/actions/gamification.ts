"use server";

import { createClient } from "@/lib/supabase/server";
import { apiRateLimit } from "@/lib/rate-limit";
import {
	getGlobalLeaderboard,
	getGenreLeaderboard,
	getLeaderboardCount,
	getGenreLeaderboardCount,
	type LeaderboardEntry,
} from "@/lib/gamification/queries";

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
	const user = await requireUser();

	const { success: rlSuccess } = await apiRateLimit.limit(user.id);
	if (!rlSuccess) {
		return [];
	}

	return getGlobalLeaderboard(page);
}

export async function loadGenreLeaderboard(
	genre: string,
	page?: number,
): Promise<LeaderboardEntry[]> {
	const user = await requireUser();

	const { success: rlSuccess } = await apiRateLimit.limit(user.id);
	if (!rlSuccess) {
		return [];
	}

	return getGenreLeaderboard(genre, page);
}

export async function loadLeaderboardCount(): Promise<number> {
	const user = await requireUser();

	const { success: rlSuccess } = await apiRateLimit.limit(user.id);
	if (!rlSuccess) {
		return 0;
	}

	return getLeaderboardCount();
}

export async function loadGenreLeaderboardCount(
	genre: string,
): Promise<number> {
	const user = await requireUser();

	const { success: rlSuccess } = await apiRateLimit.limit(user.id);
	if (!rlSuccess) {
		return 0;
	}

	return getGenreLeaderboardCount(genre);
}
