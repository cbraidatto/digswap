import { desc, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { collectionItems } from "@/lib/db/schema/collections";
import { releases } from "@/lib/db/schema/releases";
import { profiles } from "@/lib/db/schema/users";

export interface WhoHasItEntry {
	userId: string;
	username: string | null;
	displayName: string | null;
	avatarUrl: string | null;
	conditionGrade: string | null;
}

export async function findWhoHasRelease(discogsId: number, limit = 20): Promise<WhoHasItEntry[]> {
	const rows = await db
		.select({
			userId: collectionItems.userId,
			username: profiles.username,
			displayName: profiles.displayName,
			avatarUrl: profiles.avatarUrl,
			conditionGrade: collectionItems.conditionGrade,
		})
		.from(collectionItems)
		.innerJoin(releases, eq(collectionItems.releaseId, releases.id))
		.innerJoin(profiles, eq(collectionItems.userId, profiles.id))
		.where(eq(releases.discogsId, discogsId))
		.orderBy(desc(releases.rarityScore))
		.limit(limit);
	return rows;
}
