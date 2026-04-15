import "server-only";

import { and, eq, isNull, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { collectionItems } from "@/lib/db/schema/collections";
import { releases } from "@/lib/db/schema/releases";
import { makeAlbumKey, normalizeForDedup } from "./normalize";

export interface TrackSyncPayload {
	localTrackId: string;
	filePath: string;
	artist: string | null;
	album: string | null;
	title: string | null;
	year: number | null;
	trackNumber: number | null;
	format: string;
	bitrate: number;
	sampleRate: number;
	duration: number;
	artistConfidence: "high" | "low";
	albumConfidence: "high" | "low";
}

export interface ReleaseMapping {
	albumKey: string;
	releaseId: string;
}

export interface SyncResponse {
	ok: boolean;
	synced: number;
	created: number;
	linked: number;
	deleted: number;
	dedupQueued: number;
	releaseMappings: ReleaseMapping[];
	errors: string[];
}

/**
 * Process a batch of track metadata from the desktop app.
 *
 * 1. Groups tracks by normalized album key
 * 2. For each album: finds or creates a release record
 * 3. Upserts collection items for each track
 * 4. Soft-deletes items for deletedReleaseIds
 * 5. Returns counts and releaseMappings
 */
export async function processSyncBatch(
	userId: string,
	tracks: TrackSyncPayload[],
	deletedReleaseIds: string[],
): Promise<SyncResponse> {
	const response: SyncResponse = {
		ok: true,
		synced: 0,
		created: 0,
		linked: 0,
		deleted: 0,
		dedupQueued: 0,
		releaseMappings: [],
		errors: [],
	};

	// Step 1: Group tracks by album key
	const albumGroups = new Map<string, { tracks: TrackSyncPayload[]; artist: string | null; album: string | null; year: number | null }>();

	for (const track of tracks) {
		const key = makeAlbumKey(track.artist, track.album);
		const existing = albumGroups.get(key);
		if (existing) {
			existing.tracks.push(track);
		} else {
			albumGroups.set(key, {
				tracks: [track],
				artist: track.artist,
				album: track.album,
				year: track.year,
			});
		}
	}

	// Step 2: For each album group, find or create a release
	for (const [albumKey, group] of albumGroups) {
		try {
			const normalizedArtist = normalizeForDedup(group.artist);
			const normalizedAlbum = normalizeForDedup(group.album);

			// Query existing releases by normalized artist + title
			const existingReleases = await db
				.select({ id: releases.id, discogsId: releases.discogsId })
				.from(releases)
				.where(
					and(
						sql`lower(${releases.artist}) = ${normalizedArtist}`,
						sql`lower(${releases.title}) = ${normalizedAlbum}`,
					),
				);

			let releaseId: string;

			if (existingReleases.length > 0) {
				// Prefer Discogs-matched release, fall back to any existing
				const discogsMatch = existingReleases.find((r) => r.discogsId !== null);
				releaseId = discogsMatch ? discogsMatch.id : existingReleases[0].id;

				if (discogsMatch) {
					response.linked++;
				}
			} else {
				// Create a new local-only release
				const [newRelease] = await db
					.insert(releases)
					.values({
						title: group.album ?? "Unknown Album",
						artist: group.artist ?? "Unknown Artist",
						year: group.year,
					})
					.returning({ id: releases.id });

				releaseId = newRelease.id;
				response.created++;
			}

			// Record the mapping
			response.releaseMappings.push({ albumKey, releaseId });

			// Step 3: Upsert collection items for each track in this album group
			for (const track of group.tracks) {
				const isLowConfidence = track.artistConfidence === "low" || track.albumConfidence === "low";

				// Count low-confidence items that did NOT match a Discogs release
				if (isLowConfidence && !existingReleases.some((r) => r.discogsId !== null)) {
					response.dedupQueued++;
				}

				await db
					.insert(collectionItems)
					.values({
						userId,
						releaseId,
						addedVia: "local",
						deletedAt: null,
					})
					.onConflictDoUpdate({
						target: [collectionItems.userId, collectionItems.releaseId],
						set: {
							updatedAt: sql`now()`,
							deletedAt: null,
						},
					})
					.returning({ id: collectionItems.id });

				response.synced++;
			}
		} catch (err) {
			const message = err instanceof Error ? err.message : String(err);
			response.errors.push(`Album "${albumKey}": ${message}`);
		}
	}

	// Step 4: Soft-delete collection items for deleted release IDs
	if (deletedReleaseIds.length > 0) {
		try {
			for (const releaseId of deletedReleaseIds) {
				await db
					.update(collectionItems)
					.set({ deletedAt: sql`now()` })
					.where(
						and(
							eq(collectionItems.userId, userId),
							eq(collectionItems.releaseId, releaseId),
							eq(collectionItems.addedVia, "local"),
							isNull(collectionItems.deletedAt),
						),
					);
				response.deleted++;
			}
		} catch (err) {
			const message = err instanceof Error ? err.message : String(err);
			response.errors.push(`Soft-delete: ${message}`);
		}
	}

	if (response.errors.length > 0) {
		response.ok = false;
	}

	return response;
}
