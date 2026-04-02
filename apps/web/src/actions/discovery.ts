"use server";

import { createClient } from "@/lib/supabase/server";
import { apiRateLimit } from "@/lib/rate-limit";
import {
	searchRecords,
	browseRecords,
	getSuggestedRecords,
} from "@/lib/discovery/queries";
import { searchRecordsSchema, browseRecordsSchema } from "@/lib/validations/discovery";

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

		const { success: rlSuccess } = await apiRateLimit.limit(user.id);
		if (!rlSuccess) {
			return [];
		}

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
 * Per DISC2-02.
 */
export async function browseRecordsAction(
	genre: string | null,
	decade: string | null,
	page = 1,
) {
	try {
		const parsed = browseRecordsSchema.safeParse({ genre, decade, page });
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

		const { success: rlSuccess } = await apiRateLimit.limit(user.id);
		if (!rlSuccess) {
			return [];
		}

		const offset = (parsed.data.page - 1) * PAGE_SIZE;
		return browseRecords(parsed.data.genre, parsed.data.decade, PAGE_SIZE, offset);
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

		const { success: rlSuccess } = await apiRateLimit.limit(user.id);
		if (!rlSuccess) {
			return [];
		}

		return getSuggestedRecords(user.id);
	} catch (err) {
		console.error("[getSuggestionsAction] error:", err);
		return [];
	}
}
