"use server";

import { createClient } from "@/lib/supabase/server";
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
	await requireUser();
	return getGlobalLeaderboard(page);
}

export async function loadGenreLeaderboard(
	genre: string,
	page?: number,
): Promise<LeaderboardEntry[]> {
	await requireUser();
	return getGenreLeaderboard(genre, page);
}

export async function loadLeaderboardCount(): Promise<number> {
	await requireUser();
	return getLeaderboardCount();
}

export async function loadGenreLeaderboardCount(
	genre: string,
): Promise<number> {
	await requireUser();
	return getGenreLeaderboardCount(genre);
}
