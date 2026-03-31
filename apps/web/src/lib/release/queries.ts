import { eq, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { releases } from "@/lib/db/schema/releases";
import { collectionItems } from "@/lib/db/schema/collections";
import { profiles } from "@/lib/db/schema/users";

export interface ReleaseOwner {
  userId: string;
  username: string | null;
  avatarUrl: string | null;
  displayName: string | null;
  conditionGrade: string | null;
}

/**
 * Fetch a release by its Discogs ID.
 * Uses Drizzle db client (bypasses RLS) for public page access.
 */
export async function getReleaseByDiscogsId(discogsId: number) {
  const [release] = await db
    .select()
    .from(releases)
    .where(eq(releases.discogsId, discogsId))
    .limit(1);
  return release ?? null;
}

/**
 * Get users who own a specific release, with profile data.
 * Default limit of 12 matches the locked decision "top 12 by default".
 */
export async function getOwnersByReleaseId(
  releaseId: string,
  limit = 12,
): Promise<ReleaseOwner[]> {
  return db
    .select({
      userId: collectionItems.userId,
      username: profiles.username,
      avatarUrl: profiles.avatarUrl,
      displayName: profiles.displayName,
      conditionGrade: collectionItems.conditionGrade,
    })
    .from(collectionItems)
    .innerJoin(profiles, eq(collectionItems.userId, profiles.id))
    .where(eq(collectionItems.releaseId, releaseId))
    .limit(limit);
}

/**
 * Get the total count of users who own a specific release.
 * Uses sql<number>`count(*)::int` pattern consistent with existing queries.
 */
export async function getOwnerCountByReleaseId(
  releaseId: string,
): Promise<number> {
  const result = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(collectionItems)
    .where(eq(collectionItems.releaseId, releaseId));
  return Number(result[0]?.count ?? 0);
}
