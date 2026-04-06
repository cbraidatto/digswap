"use server";

import { createClient } from "@/lib/supabase/server";
import { apiRateLimit , safeLimit} from "@/lib/rate-limit";
import {
	searchRecords,
	browseRecords,
	getSuggestedRecords,
	getTrendingRecords,
	type TrendingRecord,
} from "@/lib/discovery/queries";
import { searchRecordsSchema, browseRecordsSchema } from "@/lib/validations/discovery";
import { logSearchSignal } from "@/actions/search-signals";

const PAGE_SIZE = 20;

/**
 * Search records by title or artist. Requires authenticated user.
 * Validates minimum term length of 2 characters.
 *
 * Per DISC2-01.
 */
export async function searchRecordsAction(term: string) {
	try {
		const parsed = searchRecordsSchema.safeParse({ term });
		if (!parsed.success) {
			return [];
		}

		const supabase = await createClient();
		const {
			data: { user },
		} = await supabase.auth.getUser();

		if (!user) {
			return [];
		}

		const { success: rlSuccess } = await safeLimit(apiRateLimit, user.id, false);
		if (!rlSuccess) {
			return [];
		}

		// Fire-and-forget signal logging — don't await to keep latency low
		void logSearchSignal([parsed.data.term], []);

		return searchRecords(parsed.data.term);
	} catch (err) {
		console.error("[searchRecordsAction] error:", err);
		return [];
	}
}

/**
 * Browse records filtered by genre and/or decade with pagination.
 * Requires authenticated user.
 *
 * Per DISC2-02. Extended in S03: multi-genre, country, format, minRarity.
 */
export async function browseRecordsAction(
	genre: string | null,
	decade: string | null,
	page = 1,
	genres: string[] = [],
	country: string | null = null,
	format: string | null = null,
	minRarity = 0,
	styles: string[] = [],
	label: string | null = null,
	sort = "rarity",
	yearFrom: number | null = null,
	yearTo: number | null = null,
) {
	try {
		const parsed = browseRecordsSchema.safeParse({ genre, decade, page, genres, country, format, minRarity });
		if (!parsed.success) {
			return [];
		}

		const supabase = await createClient();
		const {
			data: { user },
		} = await supabase.auth.getUser();

		if (!user) {
			return [];
		}

		const { success: rlSuccess } = await safeLimit(apiRateLimit, user.id, false);
		if (!rlSuccess) {
			return [];
		}

		const offset = (parsed.data.page - 1) * PAGE_SIZE;

		// Log search signals when genre filters are active
		const allGenres = [
			...(parsed.data.genre ? [parsed.data.genre] : []),
			...parsed.data.genres,
		];
		if (allGenres.length > 0) {
			void logSearchSignal([], allGenres);
		}

		return browseRecords(
			parsed.data.genre,
			parsed.data.decade,
			PAGE_SIZE,
			offset,
			parsed.data.genres,
			parsed.data.country,
			parsed.data.format,
			parsed.data.minRarity,
			styles,
			label,
			sort,
			yearFrom,
			yearTo,
			user.id,
		);
	} catch (err) {
		console.error("[browseRecordsAction] error:", err);
		return [];
	}
}

/**
 * Get personalized record suggestions for the current user.
 * Based on top genres and followed users' collections.
 *
 * Per DISC2-04.
 */
export async function getSuggestionsAction() {
	try {
		const supabase = await createClient();
		const {
			data: { user },
		} = await supabase.auth.getUser();

		if (!user) {
			return [];
		}

		const { success: rlSuccess } = await safeLimit(apiRateLimit, user.id, false);
		if (!rlSuccess) {
			return [];
		}

		return getSuggestedRecords(user.id);
	} catch (err) {
		console.error("[getSuggestionsAction] error:", err);
		return [];
	}
}

/**
 * Get trending records — most added to collections in the last 7 days.
 */
export async function getTrendingAction(): Promise<TrendingRecord[]> {
	try {
		const supabase = await createClient();
		const {
			data: { user },
		} = await supabase.auth.getUser();

		if (!user) return [];

		const { success: rlSuccess } = await safeLimit(apiRateLimit, user.id, false);
		if (!rlSuccess) return [];

		return getTrendingRecords(10);
	} catch (err) {
		console.error("[getTrendingAction] error:", err);
		return [];
	}
}
