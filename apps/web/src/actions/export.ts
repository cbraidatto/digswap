"use server";

import { eq } from "drizzle-orm";
import { requireUser } from "@/lib/auth/require-user";
import { db } from "@/lib/db";
import { collectionItems } from "@/lib/db/schema/collections";
import { releases } from "@/lib/db/schema/releases";
import { wantlistItems } from "@/lib/db/schema/wantlist";
import { apiRateLimit, safeLimit } from "@/lib/rate-limit";

/**
 * Export the current user's collection as a CSV string.
 * Returns the CSV content directly — the client can create a Blob/download.
 */
export async function exportCollectionCsv(): Promise<{
	csv?: string;
	error?: string;
}> {
	try {
		const user = await requireUser();

		const { success: rlSuccess } = await safeLimit(apiRateLimit, user.id, true);
		if (!rlSuccess) {
			return { error: "Too many requests. Please wait a moment." };
		}

		const items = await db
			.select({
				title: releases.title,
				artist: releases.artist,
				year: releases.year,
				genre: releases.genre,
				style: releases.style,
				format: releases.format,
				label: releases.label,
				country: releases.country,
				conditionGrade: collectionItems.conditionGrade,
				addedVia: collectionItems.addedVia,
				discogsId: releases.discogsId,
				rarityScore: releases.rarityScore,
				createdAt: collectionItems.createdAt,
			})
			.from(collectionItems)
			.innerJoin(releases, eq(collectionItems.releaseId, releases.id))
			.where(eq(collectionItems.userId, user.id))
			.orderBy(releases.title);

		// Build CSV
		const headers = [
			"Title",
			"Artist",
			"Year",
			"Genre",
			"Style",
			"Format",
			"Label",
			"Country",
			"Condition",
			"Added Via",
			"Discogs ID",
			"Rarity Score",
			"Date Added",
		];

		function escapeCsv(value: string | null | undefined): string {
			if (value == null) return "";
			const str = String(value);
			if (str.includes(",") || str.includes('"') || str.includes("\n")) {
				return `"${str.replace(/"/g, '""')}"`;
			}
			return str;
		}

		const rows = items.map((item) =>
			[
				escapeCsv(item.title),
				escapeCsv(item.artist),
				escapeCsv(item.year?.toString()),
				escapeCsv(item.genre?.join("; ")),
				escapeCsv(item.style?.join("; ")),
				escapeCsv(item.format),
				escapeCsv(item.label),
				escapeCsv(item.country),
				escapeCsv(item.conditionGrade),
				escapeCsv(item.addedVia),
				escapeCsv(item.discogsId?.toString()),
				escapeCsv(item.rarityScore?.toFixed(2)),
				escapeCsv(item.createdAt.toISOString().split("T")[0]),
			].join(","),
		);

		const csv = [headers.join(","), ...rows].join("\n");

		return { csv };
	} catch (err) {
		console.error("[exportCollectionCsv] error:", err);
		return { error: "Failed to export collection." };
	}
}

/**
 * Export the current user's wantlist as a CSV string.
 */
export async function exportWantlistCsv(): Promise<{
	csv?: string;
	error?: string;
}> {
	try {
		const user = await requireUser();

		const { success: rlSuccess } = await safeLimit(apiRateLimit, user.id, true);
		if (!rlSuccess) return { error: "Too many requests." };

		const items = await db
			.select({
				title: releases.title,
				artist: releases.artist,
				year: releases.year,
				genre: releases.genre,
				format: releases.format,
				label: releases.label,
				discogsId: releases.discogsId,
				rarityScore: releases.rarityScore,
				createdAt: wantlistItems.createdAt,
			})
			.from(wantlistItems)
			.innerJoin(releases, eq(wantlistItems.releaseId, releases.id))
			.where(eq(wantlistItems.userId, user.id))
			.orderBy(releases.title);

		const headers = [
			"Title",
			"Artist",
			"Year",
			"Genre",
			"Format",
			"Label",
			"Discogs ID",
			"Rarity Score",
			"Date Added",
		];

		function esc(v: string | null | undefined): string {
			if (v == null) return "";
			const s = String(v);
			return s.includes(",") || s.includes('"') || s.includes("\n")
				? `"${s.replace(/"/g, '""')}"`
				: s;
		}

		const rows = items.map((i) =>
			[
				esc(i.title),
				esc(i.artist),
				esc(i.year?.toString()),
				esc(i.genre?.join("; ")),
				esc(i.format),
				esc(i.label),
				esc(i.discogsId?.toString()),
				esc(i.rarityScore?.toFixed(2)),
				esc(i.createdAt.toISOString().split("T")[0]),
			].join(","),
		);

		return { csv: [headers.join(","), ...rows].join("\n") };
	} catch (err) {
		console.error("[exportWantlistCsv] error:", err);
		return { error: "Failed to export wantlist." };
	}
}
