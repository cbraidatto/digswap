import { and, asc, count, desc, eq, inArray, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { crateItems, crates, sets, setTracks } from "@/lib/db/schema/crates";
import { profiles } from "@/lib/db/schema/users";
import type { CrateItemRow, CrateRow, SetWithTracks } from "./types";

/**
 * Returns all crates for a user, ordered by date DESC then createdAt DESC.
 * Includes an itemCount derived from a left join on crate_items.
 */
export async function getCrates(userId: string): Promise<(CrateRow & { itemCount: number })[]> {
	const rows = await db
		.select({
			id: crates.id,
			userId: crates.userId,
			name: crates.name,
			date: crates.date,
			sessionType: crates.sessionType,
			isPublic: crates.isPublic,
			createdAt: crates.createdAt,
			updatedAt: crates.updatedAt,
			itemCount: count(crateItems.id),
		})
		.from(crates)
		.leftJoin(crateItems, eq(crateItems.crateId, crates.id))
		.where(eq(crates.userId, userId))
		.groupBy(crates.id)
		.orderBy(desc(crates.date), desc(crates.createdAt));

	return rows.map((r) => ({ ...r, itemCount: Number(r.itemCount) }));
}

/**
 * Returns a single crate by id for a given user, or null if not found / not owned.
 */
export async function getCrateById(crateId: string, userId: string): Promise<CrateRow | null> {
	const rows = await db
		.select()
		.from(crates)
		.where(and(eq(crates.id, crateId), eq(crates.userId, userId)))
		.limit(1);

	return rows[0] ?? null;
}

/**
 * Returns all items for a crate, active items first, then found items, both
 * ordered by createdAt ASC within their group.
 */
export async function getCrateItems(crateId: string, userId: string): Promise<CrateItemRow[]> {
	return db
		.select()
		.from(crateItems)
		.where(and(eq(crateItems.crateId, crateId), eq(crateItems.userId, userId)))
		.orderBy(
			asc(sql`CASE WHEN ${crateItems.status} = 'active' THEN 0 ELSE 1 END`),
			asc(crateItems.createdAt),
		);
}

/**
 * Returns all sets for a crate with their ordered tracks.
 * Uses two separate queries (sets + tracks) assembled in JS to avoid a
 * complex multi-level join.
 */
export async function getSetsForCrate(crateId: string, userId: string): Promise<SetWithTracks[]> {
	// 1. Fetch sets for crate
	const setsRows = await db
		.select()
		.from(sets)
		.where(and(eq(sets.crateId, crateId), eq(sets.userId, userId)))
		.orderBy(desc(sets.eventDate), desc(sets.createdAt));

	if (setsRows.length === 0) return [];

	const setIds = setsRows.map((s) => s.id);

	// 2. Fetch tracks for all those sets in one query
	const tracksRows = await db
		.select({
			// set_tracks columns
			trackId: setTracks.id,
			setId: setTracks.setId,
			crateItemId: setTracks.crateItemId,
			trackUserId: setTracks.userId,
			position: setTracks.position,
			trackCreatedAt: setTracks.createdAt,
			// crate_items columns
			itemId: crateItems.id,
			itemCrateId: crateItems.crateId,
			itemUserId: crateItems.userId,
			itemReleaseId: crateItems.releaseId,
			itemDiscogsId: crateItems.discogsId,
			itemTitle: crateItems.title,
			itemArtist: crateItems.artist,
			itemCoverImageUrl: crateItems.coverImageUrl,
			itemStatus: crateItems.status,
			itemCreatedAt: crateItems.createdAt,
		})
		.from(setTracks)
		.innerJoin(crateItems, eq(setTracks.crateItemId, crateItems.id))
		.where(inArray(setTracks.setId, setIds))
		.orderBy(asc(setTracks.position));

	// 3. Assemble into SetWithTracks
	const tracksBySetId = new Map<string, (typeof tracksRows)[number][]>();
	for (const row of tracksRows) {
		const list = tracksBySetId.get(row.setId) ?? [];
		list.push(row);
		tracksBySetId.set(row.setId, list);
	}

	return setsRows.map((set) => {
		const rawTracks = tracksBySetId.get(set.id) ?? [];
		const tracks = rawTracks.map((t) => ({
			id: t.trackId,
			setId: t.setId,
			crateItemId: t.crateItemId,
			userId: t.trackUserId,
			position: t.position,
			createdAt: t.trackCreatedAt,
			item: {
				id: t.itemId,
				crateId: t.itemCrateId,
				userId: t.itemUserId,
				releaseId: t.itemReleaseId,
				discogsId: t.itemDiscogsId,
				title: t.itemTitle,
				artist: t.itemArtist,
				coverImageUrl: t.itemCoverImageUrl,
				status: t.itemStatus,
				createdAt: t.itemCreatedAt,
			},
		}));

		return { ...set, tracks };
	});
}

// ---------------------------------------------------------------------------
// Public crates (for discovery page)
// ---------------------------------------------------------------------------

export type PublicCrate = {
	id: string;
	name: string;
	userId: string;
	sessionType: string;
	createdAt: Date;
	itemCount: number;
	ownerUsername: string | null;
	ownerDisplayName: string | null;
	previewCovers: (string | null)[];
};

/**
 * Returns the most recent public crates with owner info and up to 4 cover images.
 */
export async function getPublicCrates(limit = 20): Promise<PublicCrate[]> {
	// 1. Fetch public crates with owner profile and item count
	const rows = await db
		.select({
			id: crates.id,
			name: crates.name,
			userId: crates.userId,
			sessionType: crates.sessionType,
			createdAt: crates.createdAt,
			itemCount: count(crateItems.id),
			ownerUsername: profiles.username,
			ownerDisplayName: profiles.displayName,
		})
		.from(crates)
		.leftJoin(crateItems, eq(crateItems.crateId, crates.id))
		.leftJoin(profiles, eq(profiles.id, crates.userId))
		.where(eq(crates.isPublic, true))
		.groupBy(crates.id, profiles.username, profiles.displayName)
		.orderBy(desc(crates.createdAt))
		.limit(limit);

	if (rows.length === 0) return [];

	// 2. Fetch up to 4 cover images per crate in one query
	const crateIds = rows.map((r) => r.id);
	const coverRows = await db
		.select({
			crateId: crateItems.crateId,
			coverImageUrl: crateItems.coverImageUrl,
		})
		.from(crateItems)
		.where(
			and(
				inArray(crateItems.crateId, crateIds),
				// only items that actually have a cover
				sql`${crateItems.coverImageUrl} IS NOT NULL`,
			),
		)
		.orderBy(asc(crateItems.createdAt));

	// Group covers by crateId, take first 4
	const coversByCrate = new Map<string, (string | null)[]>();
	for (const row of coverRows) {
		const existing = coversByCrate.get(row.crateId) ?? [];
		if (existing.length < 4) {
			existing.push(row.coverImageUrl);
			coversByCrate.set(row.crateId, existing);
		}
	}

	return rows.map((r) => ({
		...r,
		itemCount: Number(r.itemCount),
		previewCovers: coversByCrate.get(r.id) ?? [],
	}));
}
