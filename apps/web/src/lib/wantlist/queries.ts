import { eq, desc, sql, isNull, and } from "drizzle-orm";
import { db } from "@/lib/db";
import { wantlistItems } from "@/lib/db/schema/wantlist";
import { releases } from "@/lib/db/schema/releases";

export const WANTLIST_PAGE_SIZE = 24;

export interface WantlistItem {
	id: string;
	notes: string | null;
	priority: number;
	foundAt: Date | null;
	createdAt: Date;
	releaseId: string | null;
	title: string;
	artist: string;
	year: number | null;
	coverImageUrl: string | null;
	format: string | null;
}

export async function getWantlistPage(
	userId: string,
	page = 1,
): Promise<WantlistItem[]> {
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
		})
		.from(wantlistItems)
		.leftJoin(releases, eq(wantlistItems.releaseId, releases.id))
		.where(and(eq(wantlistItems.userId, userId), isNull(wantlistItems.foundAt)))
		.orderBy(desc(wantlistItems.createdAt))
		.limit(WANTLIST_PAGE_SIZE)
		.offset((page - 1) * WANTLIST_PAGE_SIZE);

	return rows as WantlistItem[];
}

export async function getWantlistTotalCount(userId: string): Promise<number> {
	const result = await db
		.select({ count: sql<number>`count(*)` })
		.from(wantlistItems)
		.where(and(eq(wantlistItems.userId, userId), isNull(wantlistItems.foundAt)));
	return Number(result[0]?.count ?? 0);
}
