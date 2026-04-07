import { and, desc, eq, isNull, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { releases } from "@/lib/db/schema/releases";
import { wantlistItems } from "@/lib/db/schema/wantlist";

export const WANTLIST_PAGE_SIZE = 24;

export interface WantlistItem {
	id: string;
	notes: string | null;
	priority: number;
	foundAt: Date | null;
	createdAt: Date;
	releaseId: string | null;
	discogsId: number | null;
	rarityScore: number | null;
	title: string;
	artist: string;
	year: number | null;
	coverImageUrl: string | null;
	format: string | null;
	huntingCount: number;
}

export async function getWantlistPage(userId: string, page = 1): Promise<WantlistItem[]> {
	const rows = await db
		.select({
			id: wantlistItems.id,
			notes: wantlistItems.notes,
			priority: wantlistItems.priority,
			foundAt: wantlistItems.foundAt,
			createdAt: wantlistItems.createdAt,
			releaseId: releases.id,
			title: releases.title,
			artist: releases.artist,
			year: releases.year,
			coverImageUrl: releases.coverImageUrl,
			format: releases.format,
			discogsId: releases.discogsId,
			rarityScore: releases.rarityScore,
			huntingCount: sql<number>`(
				SELECT count(*) FROM wantlist_items wi2
				WHERE wi2.release_id = ${wantlistItems.releaseId}
				AND wi2.user_id != ${userId}
				AND wi2.found_at IS NULL
			)`.as("hunting_count"),
		})
		.from(wantlistItems)
		.leftJoin(releases, eq(wantlistItems.releaseId, releases.id))
		.where(and(eq(wantlistItems.userId, userId), isNull(wantlistItems.foundAt)))
		.orderBy(desc(wantlistItems.createdAt))
		.limit(WANTLIST_PAGE_SIZE)
		.offset((page - 1) * WANTLIST_PAGE_SIZE);

	return rows.map((r) => ({ ...r, huntingCount: Number(r.huntingCount ?? 0) })) as WantlistItem[];
}

export async function getWantlistTotalCount(userId: string): Promise<number> {
	const result = await db
		.select({ count: sql<number>`count(*)` })
		.from(wantlistItems)
		.where(and(eq(wantlistItems.userId, userId), isNull(wantlistItems.foundAt)));
	return Number(result[0]?.count ?? 0);
}
