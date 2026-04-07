import { and, desc, eq, ne, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { releases } from "@/lib/db/schema/releases";

export interface SimilarRecord {
	id: string;
	discogsId: number | null;
	title: string;
	artist: string;
	coverImageUrl: string | null;
	rarityScore: number | null;
	year: number | null;
}

/**
 * Find records similar to a given release based on genre + style overlap
 * and year proximity. Uses the GIN-indexed genre and style array columns.
 *
 * Scoring: 2 points per shared genre + 1 point per shared style + year proximity bonus.
 */
export async function getSimilarRecords(releaseId: string, limit = 8): Promise<SimilarRecord[]> {
	// Get the source release's genre, style, and year
	const [source] = await db
		.select({
			genre: releases.genre,
			style: releases.style,
			year: releases.year,
		})
		.from(releases)
		.where(eq(releases.id, releaseId))
		.limit(1);

	if (!source || (!source.genre?.length && !source.style?.length)) {
		return [];
	}

	const genreArr = source.genre ?? [];
	const styleArr = source.style ?? [];

	if (genreArr.length === 0 && styleArr.length === 0) return [];

	// Build similarity score using array overlap
	// cardinality(array(select unnest(a) intersect select unnest(b))) counts overlap
	const rows = await db
		.select({
			id: releases.id,
			discogsId: releases.discogsId,
			title: releases.title,
			artist: releases.artist,
			coverImageUrl: releases.coverImageUrl,
			rarityScore: releases.rarityScore,
			year: releases.year,
			similarity: sql<number>`(
				coalesce(cardinality(ARRAY(SELECT unnest(${releases.genre}) INTERSECT SELECT unnest(${genreArr}::text[]))), 0) * 2
				+ coalesce(cardinality(ARRAY(SELECT unnest(${releases.style}) INTERSECT SELECT unnest(${styleArr}::text[]))), 0)
				+ CASE WHEN ${releases.year} IS NOT NULL AND ${source.year ?? 0} > 0
					THEN GREATEST(0, 5 - ABS(${releases.year} - ${source.year ?? 0}) / 2)
					ELSE 0
				END
			)`.as("similarity"),
		})
		.from(releases)
		.where(
			and(
				ne(releases.id, releaseId),
				sql`${releases.genre} && ${genreArr}::text[]`, // at least one genre overlap (uses GIN index)
			),
		)
		.orderBy(desc(sql`similarity`))
		.limit(limit);

	return rows
		.filter((r) => Number(r.similarity) > 0)
		.map((r) => ({
			id: r.id,
			discogsId: r.discogsId,
			title: r.title,
			artist: r.artist,
			coverImageUrl: r.coverImageUrl,
			rarityScore: r.rarityScore,
			year: r.year,
		}));
}
