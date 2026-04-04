"use server";

import { createClient } from "@/lib/supabase/server";
import { db } from "@/lib/db";
import { digs, diggerDna } from "@/lib/db/schema/engagement";
import { listeningLogs } from "@/lib/db/schema/listening-logs";
import { activityFeed } from "@/lib/db/schema/social";
import { collectionItems } from "@/lib/db/schema/collections";
import { releases } from "@/lib/db/schema/releases";
import { eq, and, sql, count } from "drizzle-orm";
import { apiRateLimit , safeLimit} from "@/lib/rate-limit";
import { z } from "zod";

// ── Validation schemas ─────────────────────────────────────
const feedItemIdSchema = z.object({
	feedItemId: z.string().uuid(),
});

const logListeningSchema = z.object({
	releaseId: z.string().uuid(),
	caption: z.string().max(280).optional(),
	rating: z.number().int().min(1).max(5).optional(),
});

// ── Helpers ────────────────────────────────────────────────
async function requireUser() {
	const supabase = await createClient();
	const {
		data: { user },
	} = await supabase.auth.getUser();
	if (!user) throw new Error("Not authenticated");
	return user;
}

// ── "Dig!" reaction ────────────────────────────────────────
export async function toggleDig(
	feedItemId: string,
): Promise<{ dug: boolean; digCount: number; error?: string }> {
	try {
		const parsed = feedItemIdSchema.safeParse({ feedItemId });
		if (!parsed.success) {
			return { dug: false, digCount: 0, error: "Invalid feed item" };
		}

		const user = await requireUser();

		const { success: rlSuccess } = await safeLimit(apiRateLimit, user.id, true);
		if (!rlSuccess) {
			return { dug: false, digCount: 0, error: "Too many requests" };
		}

		// SECURITY: Atomic toggle via transaction to prevent race condition (double-dig)
		const result = await db.transaction(async (tx) => {
			const existing = await tx
				.select({ id: digs.id })
				.from(digs)
				.where(
					and(
						eq(digs.userId, user.id),
						eq(digs.feedItemId, parsed.data.feedItemId),
					),
				);

			if (existing.length > 0) {
				await tx
					.delete(digs)
					.where(
						and(
							eq(digs.userId, user.id),
							eq(digs.feedItemId, parsed.data.feedItemId),
						),
					);
			} else {
				await tx.insert(digs).values({
					userId: user.id,
					feedItemId: parsed.data.feedItemId,
				});
			}

			const countResult = await tx
				.select({ count: count() })
				.from(digs)
				.where(eq(digs.feedItemId, parsed.data.feedItemId));

			return {
				dug: existing.length === 0,
				digCount: Number(countResult[0]?.count ?? 0),
			};
		});

		return result;
	} catch (err) {
		console.error("[toggleDig] error:", err);
		return { dug: false, digCount: 0, error: "Could not toggle dig" };
	}
}

export async function getDigState(
	feedItemIds: string[],
): Promise<Record<string, { dug: boolean; digCount: number }>> {
	try {
		if (feedItemIds.length === 0) return {};

		// SECURITY: Limit array size to prevent DoS via massive SQL IN clause
		if (feedItemIds.length > 100) {
			feedItemIds = feedItemIds.slice(0, 100);
		}

		const user = await requireUser();

		// Get user's digs
		const userDigs = await db
			.select({ feedItemId: digs.feedItemId })
			.from(digs)
			.where(
				and(
					eq(digs.userId, user.id),
					sql`${digs.feedItemId} = ANY(${feedItemIds})`,
				),
			);

		const userDigSet = new Set(userDigs.map((d) => d.feedItemId));

		// Get counts
		const counts = await db
			.select({
				feedItemId: digs.feedItemId,
				count: count(),
			})
			.from(digs)
			.where(sql`${digs.feedItemId} = ANY(${feedItemIds})`)
			.groupBy(digs.feedItemId);

		const countMap = new Map(counts.map((c) => [c.feedItemId, Number(c.count)]));

		const result: Record<string, { dug: boolean; digCount: number }> = {};
		for (const id of feedItemIds) {
			result[id] = {
				dug: userDigSet.has(id),
				digCount: countMap.get(id) ?? 0,
			};
		}

		return result;
	} catch (err) {
		console.error("[getDigState] error:", err);
		return {};
	}
}

// ── Digger DNA computation ─────────────────────────────────
export async function computeDiggerDna(
	userId?: string,
): Promise<{
	topGenres: { name: string; percentage: number }[];
	topDecades: { decade: string; percentage: number }[];
	topCountries: { name: string; count: number }[];
	rarityProfile: string;
	avgRarity: number;
	totalRecords: number;
	error?: string;
}> {
	const empty = {
		topGenres: [],
		topDecades: [],
		topCountries: [],
		rarityProfile: "newcomer",
		avgRarity: 0,
		totalRecords: 0,
	};

	try {
		const currentUser = await requireUser();

		// If a userId is provided it must match the authenticated user.
		// Allowing arbitrary userId here would let any authenticated user
		// overwrite another user's diggerDna row (IDOR on the upsert below).
		if (userId && userId !== currentUser.id) {
			return { ...empty, error: "Forbidden" };
		}

		const targetUserId = currentUser.id;

		// Get all user's releases with metadata
		const items = await db
			.select({
				genre: releases.genre,
				style: releases.style,
				year: releases.year,
				country: releases.country,
				rarityScore: releases.rarityScore,
			})
			.from(collectionItems)
			.innerJoin(releases, eq(collectionItems.releaseId, releases.id))
			.where(eq(collectionItems.userId, targetUserId));

		if (items.length === 0) return empty;

		// ─── Genre distribution
		const genreCounts = new Map<string, number>();
		for (const item of items) {
			for (const g of item.genre ?? []) {
				genreCounts.set(g, (genreCounts.get(g) ?? 0) + 1);
			}
		}
		const totalGenreEntries = Array.from(genreCounts.values()).reduce(
			(a, b) => a + b,
			0,
		);
		const topGenres = Array.from(genreCounts.entries())
			.sort((a, b) => b[1] - a[1])
			.slice(0, 5)
			.map(([name, cnt]) => ({
				name,
				percentage: Math.round((cnt / totalGenreEntries) * 100),
			}));

		// ─── Decade distribution
		const decadeCounts = new Map<string, number>();
		for (const item of items) {
			if (item.year) {
				const decade = `${Math.floor(item.year / 10) * 10}s`;
				decadeCounts.set(decade, (decadeCounts.get(decade) ?? 0) + 1);
			}
		}
		const topDecades = Array.from(decadeCounts.entries())
			.sort((a, b) => b[1] - a[1])
			.slice(0, 5)
			.map(([decade, cnt]) => ({
				decade,
				percentage: Math.round((cnt / items.length) * 100),
			}));

		// ─── Country distribution
		const countryCounts = new Map<string, number>();
		for (const item of items) {
			if (item.country) {
				countryCounts.set(
					item.country,
					(countryCounts.get(item.country) ?? 0) + 1,
				);
			}
		}
		const topCountries = Array.from(countryCounts.entries())
			.sort((a, b) => b[1] - a[1])
			.slice(0, 5)
			.map(([name, cnt]) => ({ name, count: cnt }));

		// ─── Rarity profile
		const rarityScores = items
			.map((i) => i.rarityScore)
			.filter((s): s is number => s !== null);
		const avgRarity =
			rarityScores.length > 0
				? rarityScores.reduce((a, b) => a + b, 0) / rarityScores.length
				: 0;

		let rarityProfile: string;
		if (avgRarity >= 75) rarityProfile = "ultra_rare_hunter";
		else if (avgRarity >= 50) rarityProfile = "deep_cutter";
		else if (avgRarity >= 25) rarityProfile = "balanced_digger";
		else rarityProfile = "mainstream_maven";

		const result = {
			topGenres,
			topDecades,
			topCountries,
			rarityProfile,
			avgRarity: Math.round(avgRarity * 10) / 10,
			totalRecords: items.length,
		};

		// Persist to DB for caching
		try {
			await db
				.insert(diggerDna)
				.values({
					userId: targetUserId,
					...result,
				})
				.onConflictDoUpdate({
					target: diggerDna.userId,
					set: {
						...result,
						updatedAt: new Date(),
					},
				});
		} catch {
			// Non-blocking — computation still succeeds
		}

		return result;
	} catch (err) {
		console.error("[computeDiggerDna] error:", err);
		return { ...empty, error: "Could not compute Digger DNA" };
	}
}

export async function getDiggerDna(userId: string) {
	try {
		// SECURITY: Require authentication to prevent enumeration of all users' DNA profiles
		const user = await requireUser();

		const { success: rlSuccess } = await safeLimit(apiRateLimit, user.id, false);
		if (!rlSuccess) return null;

		const result = await db
			.select({
				userId: diggerDna.userId,
				topGenres: diggerDna.topGenres,
				topDecades: diggerDna.topDecades,
				topCountries: diggerDna.topCountries,
				rarityProfile: diggerDna.rarityProfile,
				avgRarity: diggerDna.avgRarity,
				totalRecords: diggerDna.totalRecords,
			})
			.from(diggerDna)
			.where(eq(diggerDna.userId, userId));

		return result[0] ?? null;
	} catch (err) {
		console.error("[getDiggerDna] error:", err);
		return null;
	}
}

// ── Log a listen (Spinning Log) ───────────────────────────
export async function logListening(
	releaseId: string,
	caption?: string,
	rating?: number,
): Promise<{ success: boolean; error?: string }> {
	try {
		const user = await requireUser();

		const { success: rlSuccess } = await safeLimit(apiRateLimit, user.id, true);
		if (!rlSuccess) {
			return { success: false, error: "Too many requests" };
		}

		const parsed = logListeningSchema.safeParse({ releaseId, caption, rating });
		if (!parsed.success) {
			return { success: false, error: parsed.error.issues[0]?.message ?? "Invalid input" };
		}

		const { releaseId: validReleaseId, caption: validCaption, rating: validRating } = parsed.data;

		// Insert listening log
		await db.insert(listeningLogs).values({
			userId: user.id,
			releaseId: validReleaseId,
			caption: validCaption ?? null,
			rating: validRating ?? null,
		});

		// Insert activity feed entry
		await db.insert(activityFeed).values({
			userId: user.id,
			actionType: "spinning_now",
			targetType: "release",
			targetId: validReleaseId,
			metadata: {
				caption: validCaption ?? null,
				rating: validRating ?? null,
			},
		});

		return { success: true };
	} catch (err) {
		console.error("[logListening] error:", err);
		return { success: false, error: "Could not log listening" };
	}
}
