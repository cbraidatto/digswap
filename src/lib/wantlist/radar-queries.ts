import { and, eq, ne, inArray, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { wantlistItems } from "@/lib/db/schema/wantlist";
import { collectionItems } from "@/lib/db/schema/collections";
import { profiles } from "@/lib/db/schema/users";
import { releases } from "@/lib/db/schema/releases";

export interface RadarMatch {
  matchUserId: string;
  matchUsername: string | null;
  matchAvatarUrl: string | null;
  releaseId: string;
  discogsId: number | null;
  releaseTitle: string;
  releaseArtist: string;
  rarityScore: number | null;
  overlapCount: number;
  mutualCount: number;
}

/**
 * Returns users who own records from currentUserId's wantlist.
 * Sorted by overlapCount desc (users with the most wantlist matches first).
 * Each entry represents the top-matching release per user.
 */
export async function getRadarMatches(
  currentUserId: string,
  options: { limit?: number; rarityTier?: "common" | "rare" | "ultra_rare" } = {},
): Promise<RadarMatch[]> {
  const { limit = 5 } = options;

  // Step 1: Get current user's wantlist release IDs (unfound items only)
  const myWantlist = await db
    .select({ releaseId: wantlistItems.releaseId })
    .from(wantlistItems)
    .where(eq(wantlistItems.userId, currentUserId));

  if (myWantlist.length === 0) return [];

  const wantlistReleaseIds = myWantlist
    .map((w) => w.releaseId)
    .filter(Boolean) as string[];

  if (wantlistReleaseIds.length === 0) return [];

  // Step 2: Find users who own those records (excluding self)
  // Window function computes overlapCount per user inline
  const matches = await db
    .select({
      matchUserId: collectionItems.userId,
      matchUsername: profiles.username,
      matchAvatarUrl: profiles.avatarUrl,
      releaseId: collectionItems.releaseId,
      discogsId: releases.discogsId,
      releaseTitle: releases.title,
      releaseArtist: releases.artist,
      rarityScore: releases.rarityScore,
      overlapCount: sql<number>`count(*) over (partition by ${collectionItems.userId})`,
    })
    .from(collectionItems)
    .innerJoin(profiles, eq(collectionItems.userId, profiles.id))
    .innerJoin(releases, eq(collectionItems.releaseId, releases.id))
    .where(
      and(
        inArray(collectionItems.releaseId, wantlistReleaseIds),
        ne(collectionItems.userId, currentUserId),
      ),
    )
    .orderBy(
      sql`count(*) over (partition by ${collectionItems.userId}) desc`,
      sql`${releases.rarityScore} desc nulls last`,
    )
    .limit(limit * 3); // over-fetch then deduplicate to top match per user

  // Step 3: Deduplicate -- keep highest rarity record per user
  const seen = new Set<string>();
  const deduped: RadarMatch[] = [];
  for (const m of matches) {
    if (!seen.has(m.matchUserId) && deduped.length < limit) {
      seen.add(m.matchUserId);
      deduped.push({
        matchUserId: m.matchUserId,
        matchUsername: m.matchUsername,
        matchAvatarUrl: m.matchAvatarUrl,
        releaseId: m.releaseId!,
        discogsId: m.discogsId ?? null,
        releaseTitle: m.releaseTitle ?? "Unknown Title",
        releaseArtist: m.releaseArtist ?? "",
        rarityScore: m.rarityScore,
        overlapCount: Number(m.overlapCount),
        mutualCount: 0, // populated in future phase when mutual matching is needed
      });
    }
  }

  return deduped;
}

/**
 * Paginated version for /radar route.
 * Re-fetches with higher limit to support pagination.
 */
export async function getRadarMatchesPaginated(
  currentUserId: string,
  options: { page?: number; pageSize?: number; rarityTier?: string } = {},
): Promise<{ matches: RadarMatch[]; hasMore: boolean }> {
  const { page = 1, pageSize = 20 } = options;
  const needed = page * pageSize + 1;
  const matches = await getRadarMatches(currentUserId, { limit: needed });
  const pageMatches = matches.slice((page - 1) * pageSize, page * pageSize);
  return { matches: pageMatches, hasMore: matches.length > page * pageSize };
}
