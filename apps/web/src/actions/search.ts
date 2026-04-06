"use server";

import { z } from "zod";
import { ilike, or, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { releases } from "@/lib/db/schema/releases";
import { profiles } from "@/lib/db/schema/users";
import { requireUser } from "@/lib/auth/require-user";
import { apiRateLimit, safeLimit } from "@/lib/rate-limit";
import { sanitizeWildcards } from "@/lib/validations/common";

export interface GlobalSearchResult {
	records: {
		id: string;
		discogsId: number | null;
		title: string;
		artist: string;
		coverImageUrl: string | null;
		year: number | null;
	}[];
	users: {
		id: string;
		username: string | null;
		displayName: string | null;
		avatarUrl: string | null;
	}[];
}

const searchSchema = z.string().trim().min(2).max(200);

/**
 * Global search: queries records (title/artist) and users (username) in parallel.
 * Returns up to 5 records + 5 users for the dropdown.
 */
export async function globalSearchAction(
	query: string,
): Promise<GlobalSearchResult> {
	try {
		const user = await requireUser();

		const { success: rlSuccess } = await safeLimit(apiRateLimit, user.id, false);
		if (!rlSuccess) return { records: [], users: [] };

		const parsed = searchSchema.safeParse(query);
		if (!parsed.success) return { records: [], users: [] };

		const sanitized = sanitizeWildcards(parsed.data);
		const pattern = `%${sanitized}%`;

		const [records, users] = await Promise.all([
			db
				.select({
					id: releases.id,
					discogsId: releases.discogsId,
					title: releases.title,
					artist: releases.artist,
					coverImageUrl: releases.coverImageUrl,
					year: releases.year,
				})
				.from(releases)
				.where(or(ilike(releases.title, pattern), ilike(releases.artist, pattern)))
				.orderBy(sql`COALESCE(${releases.rarityScore}, -1) DESC`)
				.limit(5),
			db
				.select({
					id: profiles.id,
					username: profiles.username,
					displayName: profiles.displayName,
					avatarUrl: profiles.avatarUrl,
				})
				.from(profiles)
				.where(
					or(
						ilike(profiles.username, pattern),
						ilike(profiles.displayName, pattern),
					),
				)
				.limit(5),
		]);

		return { records, users };
	} catch (err) {
		console.error("[globalSearchAction] error:", err);
		return { records: [], users: [] };
	}
}
