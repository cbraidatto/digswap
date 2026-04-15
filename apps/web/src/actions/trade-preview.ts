"use server";

import { and, eq, isNotNull, ne } from "drizzle-orm";
import { requireUser } from "@/lib/auth/require-user";
import { db } from "@/lib/db";
import { collectionItems } from "@/lib/db/schema/collections";
import { releases } from "@/lib/db/schema/releases";
import { tradeProposalItems, tradeProposals, tradeRequests } from "@/lib/db/schema/trades";
import { env, publicEnv } from "@/lib/env";
import { createClient as createServiceClient } from "@supabase/supabase-js";

function serviceClient() {
	return createServiceClient(publicEnv.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);
}

export interface PreviewItem {
	proposalItemId: string;
	title: string;
	artist: string;
	signedUrl: string;
	declaredFormat?: string;
	declaredBitrate?: number;
	declaredSampleRate?: number;
}

/**
 * Returns the counterparty's uploaded preview items with 1-hour signed URLs.
 */
export async function getCounterpartyPreviews(
	tradeId: string,
	currentUserId: string,
): Promise<PreviewItem[]> {
	// Find the accepted proposal for this trade
	const [proposal] = await db
		.select({ id: tradeProposals.id })
		.from(tradeProposals)
		.where(and(eq(tradeProposals.tradeId, tradeId), eq(tradeProposals.status, "accepted")))
		.orderBy(tradeProposals.sequenceNumber)
		.limit(1);

	if (!proposal) return [];

	// Get counterparty's items (not owned by current user) that have a preview
	const rows = await db
		.select({
			id: tradeProposalItems.id,
			previewStoragePath: tradeProposalItems.previewStoragePath,
			declaredQuality: tradeProposalItems.declaredQuality,
			title: releases.title,
			artist: releases.artist,
		})
		.from(tradeProposalItems)
		.innerJoin(collectionItems, eq(tradeProposalItems.collectionItemId, collectionItems.id))
		.leftJoin(releases, eq(tradeProposalItems.releaseId, releases.id))
		.where(
			and(
				eq(tradeProposalItems.proposalId, proposal.id),
				ne(collectionItems.userId, currentUserId),
				isNotNull(tradeProposalItems.previewStoragePath),
			),
		);

	const supabase = serviceClient();
	const items: PreviewItem[] = [];

	for (const row of rows) {
		if (!row.previewStoragePath) continue;

		const { data } = await supabase.storage
			.from("trade-previews")
			.createSignedUrl(row.previewStoragePath, 3600);

		if (!data?.signedUrl) continue;

		// Parse declared quality string (e.g. "NM · WAV · 24-bit")
		const qualityParts = (row.declaredQuality ?? "").split(/[·\-–]/);
		const formatPart = qualityParts.find((p) => /wav|flac|mp3|aiff/i.test(p))?.trim();
		const sampleRatePart = qualityParts.find((p) => /\d+\.?\d*\s*k?hz/i.test(p))?.trim();
		const bitratePart = qualityParts.find((p) => /\d+\s*kbps/i.test(p))?.trim();

		const declaredFormat = formatPart?.toUpperCase();
		const declaredSampleRate = sampleRatePart
			? (parseFloat(sampleRatePart) * (sampleRatePart.toLowerCase().includes("k") ? 1000 : 1))
			: undefined;
		const declaredBitrate = bitratePart ? parseInt(bitratePart) : undefined;

		// Use proxy URL so Electron doesn't block direct Supabase media loads
		const proxyUrl = `/api/trade-preview/audio?itemId=${encodeURIComponent(row.id)}`;

		items.push({
			proposalItemId: row.id,
			title: row.title ?? "Unknown",
			artist: row.artist ?? "",
			signedUrl: proxyUrl,
			declaredFormat,
			declaredBitrate,
			declaredSampleRate,
		});
	}

	return items;
}

/**
 * Approve the counterparty's preview — advances trade to transferring.
 */
export async function approvePreviewAction(
	tradeId: string,
): Promise<{ success: boolean; error?: string }> {
	try {
		await requireUser();

		const [trade] = await db
			.select({ id: tradeRequests.id, status: tradeRequests.status })
			.from(tradeRequests)
			.where(eq(tradeRequests.id, tradeId))
			.limit(1);

		if (!trade) return { success: false, error: "Trade not found." };
		if (trade.status !== "previewing") return { success: false, error: "Trade is not in previewing state." };

		await db
			.update(tradeRequests)
			.set({ status: "transferring", updatedAt: new Date() })
			.where(eq(tradeRequests.id, tradeId));

		return { success: true };
	} catch (err) {
		console.error("[approvePreviewAction]", err);
		return { success: false, error: "Failed to approve preview." };
	}
}

/**
 * Decline the counterparty's preview — cancels the trade.
 */
export async function declinePreviewAction(
	tradeId: string,
): Promise<{ success: boolean; error?: string }> {
	try {
		await requireUser();

		const [trade] = await db
			.select({ id: tradeRequests.id, status: tradeRequests.status })
			.from(tradeRequests)
			.where(eq(tradeRequests.id, tradeId))
			.limit(1);

		if (!trade) return { success: false, error: "Trade not found." };
		if (trade.status !== "previewing") return { success: false, error: "Trade is not in previewing state." };

		await db
			.update(tradeRequests)
			.set({ status: "declined", updatedAt: new Date() })
			.where(eq(tradeRequests.id, tradeId));

		return { success: true };
	} catch (err) {
		console.error("[declinePreviewAction]", err);
		return { success: false, error: "Failed to decline preview." };
	}
}
