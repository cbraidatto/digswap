"use server";

import { and, count, eq, gte, lt } from "drizzle-orm";
import { db } from "@/lib/db";
import { collectionItems } from "@/lib/db/schema/collections";
import { releases } from "@/lib/db/schema/releases";
import { reviews } from "@/lib/db/schema/reviews";
import { follows } from "@/lib/db/schema/social";
import { createClient } from "@/lib/supabase/server";

interface WrappedStats {
	year: number;
	recordsAdded: number;
	reviewsWritten: number;
	topGenres: { name: string; count: number }[];
	topArtists: { name: string; count: number }[];
	rarestFind: { title: string; artist: string; rarityScore: number } | null;
	followersGained: number;
	avgRarity: number;
	totalValue: string; // qualitative: "Impressive", "Growing", etc.
}

export async function generateWrapped(userId: string, year?: number): Promise<WrappedStats | null> {
	try {
		// Auth enforcement: ignore the caller-supplied userId, always use the
		// authenticated user's ID. Server Actions are RPC endpoints — any
		// authenticated user could supply another user's UUID without this check.
		const supabase = await createClient();
		const {
			data: { user },
		} = await supabase.auth.getUser();
		if (!user) return null;
		if (user.id !== userId) return null; // reject mismatched caller
		const targetYear = year ?? new Date().getFullYear();
		const startDate = new Date(`${targetYear}-01-01T00:00:00Z`);
		const endDate = new Date(`${targetYear + 1}-01-01T00:00:00Z`);

		// Records added this year
		const items = await db
			.select({
				title: releases.title,
				artist: releases.artist,
				genre: releases.genre,
				rarityScore: releases.rarityScore,
			})
			.from(collectionItems)
			.innerJoin(releases, eq(collectionItems.releaseId, releases.id))
			.where(
				and(
					eq(collectionItems.userId, userId),
					gte(collectionItems.createdAt, startDate),
					lt(collectionItems.createdAt, endDate),
				),
			);

		if (items.length === 0) return null;

		// Reviews written
		const reviewCount = await db
			.select({ count: count() })
			.from(reviews)
			.where(
				and(
					eq(reviews.userId, userId),
					gte(reviews.createdAt, startDate),
					lt(reviews.createdAt, endDate),
				),
			);

		// Followers gained
		const followerCount = await db
			.select({ count: count() })
			.from(follows)
			.where(
				and(
					eq(follows.followingId, userId),
					gte(follows.createdAt, startDate),
					lt(follows.createdAt, endDate),
				),
			);

		// Top genres
		const genreCounts = new Map<string, number>();
		for (const item of items) {
			for (const g of item.genre ?? []) {
				genreCounts.set(g, (genreCounts.get(g) ?? 0) + 1);
			}
		}
		const topGenres = Array.from(genreCounts.entries())
			.sort((a, b) => b[1] - a[1])
			.slice(0, 5)
			.map(([name, cnt]) => ({ name, count: cnt }));

		// Top artists
		const artistCounts = new Map<string, number>();
		for (const item of items) {
			if (item.artist) {
				artistCounts.set(item.artist, (artistCounts.get(item.artist) ?? 0) + 1);
			}
		}
		const topArtists = Array.from(artistCounts.entries())
			.sort((a, b) => b[1] - a[1])
			.slice(0, 5)
			.map(([name, cnt]) => ({ name, count: cnt }));

		// Rarest find
		const sorted = items
			.filter((i) => i.rarityScore !== null)
			.sort((a, b) => (b.rarityScore ?? 0) - (a.rarityScore ?? 0));

		const rarestFind = sorted[0]
			? {
					title: sorted[0].title,
					artist: sorted[0].artist,
					rarityScore: sorted[0].rarityScore!,
				}
			: null;

		// Avg rarity
		const scores = items.map((i) => i.rarityScore).filter((s): s is number => s !== null);
		const avgRarity = scores.length > 0 ? scores.reduce((a, b) => a + b, 0) / scores.length : 0;

		// Qualitative value
		let totalValue: string;
		if (items.length >= 100) totalValue = "Legendary";
		else if (items.length >= 50) totalValue = "Impressive";
		else if (items.length >= 20) totalValue = "Growing";
		else totalValue = "Getting started";

		return {
			year: targetYear,
			recordsAdded: items.length,
			reviewsWritten: Number(reviewCount[0]?.count ?? 0),
			topGenres,
			topArtists,
			rarestFind,
			followersGained: Number(followerCount[0]?.count ?? 0),
			avgRarity: Math.round(avgRarity * 10) / 10,
			totalValue,
		};
	} catch (err) {
		console.error("[generateWrapped] error:", err);
		return null;
	}
}
