import { and, asc, eq, inArray, or } from "drizzle-orm";
import { db } from "@/lib/db";
import { collectionItems } from "@/lib/db/schema/collections";
import { releases } from "@/lib/db/schema/releases";
import {
	tradeProposalItems,
	tradeProposals,
	tradeRequests,
} from "@/lib/db/schema/trades";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface TradeableItem {
	id: string;
	releaseId: string;
	title: string;
	artist: string;
	year: number | null;
	coverImageUrl: string | null;
	conditionGrade: string | null;
	audioFormat: string | null;
	bitrate: number | null;
	sampleRate: number | null;
}

export interface ProposalItemData {
	id: string;
	side: "offer" | "want";
	collectionItemId: string | null;
	releaseId: string | null;
	declaredQuality: string | null;
	conditionNotes: string | null;
	title: string | null;
	artist: string | null;
	coverImageUrl: string | null;
}

export interface ProposalWithItems {
	id: string;
	proposerId: string;
	sequenceNumber: number;
	status: string;
	message: string | null;
	createdAt: Date;
	items: ProposalItemData[];
}

// ---------------------------------------------------------------------------
// Query: tradeable collection items for a user
// ---------------------------------------------------------------------------

/**
 * Returns all collection items marked as 'tradeable' for a given user,
 * joined with release metadata for display in the proposal item picker.
 */
export async function getTradeableCollectionItems(
	userId: string,
): Promise<TradeableItem[]> {
	const rows = await db
		.select({
			id: collectionItems.id,
			releaseId: releases.id,
			title: releases.title,
			artist: releases.artist,
			year: releases.year,
			coverImageUrl: releases.coverImageUrl,
			conditionGrade: collectionItems.conditionGrade,
			audioFormat: collectionItems.audioFormat,
			bitrate: collectionItems.bitrate,
			sampleRate: collectionItems.sampleRate,
		})
		.from(collectionItems)
		.innerJoin(releases, eq(collectionItems.releaseId, releases.id))
		.where(
			and(
				eq(collectionItems.userId, userId),
				eq(collectionItems.visibility, "tradeable"),
			),
		)
		.orderBy(asc(releases.title));

	return rows.map((r) => ({
		id: r.id,
		releaseId: r.releaseId,
		title: r.title,
		artist: r.artist,
		year: r.year,
		coverImageUrl: r.coverImageUrl,
		conditionGrade: r.conditionGrade,
		audioFormat: r.audioFormat,
		bitrate: r.bitrate,
		sampleRate: r.sampleRate,
	}));
}

// ---------------------------------------------------------------------------
// Query: proposal history for a trade
// ---------------------------------------------------------------------------

/**
 * Returns the full proposal history for a trade, ordered by sequence number.
 * Only returns data if the viewer is a participant in the trade.
 *
 * Uses the two-query + JS assembly pattern (Phase 13 decision) to avoid
 * complex multi-level joins.
 */
export async function getProposalHistory(
	tradeId: string,
	viewerId: string,
): Promise<ProposalWithItems[]> {
	// Step 1: verify viewer is a participant
	const [trade] = await db
		.select({ id: tradeRequests.id })
		.from(tradeRequests)
		.where(
			and(
				eq(tradeRequests.id, tradeId),
				or(
					eq(tradeRequests.requesterId, viewerId),
					eq(tradeRequests.providerId, viewerId),
				),
			),
		)
		.limit(1);

	if (!trade) return [];

	// Step 2: fetch all proposals for this trade
	const proposals = await db
		.select({
			id: tradeProposals.id,
			proposerId: tradeProposals.proposerId,
			sequenceNumber: tradeProposals.sequenceNumber,
			status: tradeProposals.status,
			message: tradeProposals.message,
			createdAt: tradeProposals.createdAt,
		})
		.from(tradeProposals)
		.where(eq(tradeProposals.tradeId, tradeId))
		.orderBy(asc(tradeProposals.sequenceNumber));

	if (proposals.length === 0) return [];

	// Step 3: collect proposal IDs and fetch all items in one query
	const proposalIds = proposals.map((p) => p.id);

	const items = await db
		.select({
			id: tradeProposalItems.id,
			proposalId: tradeProposalItems.proposalId,
			side: tradeProposalItems.side,
			collectionItemId: tradeProposalItems.collectionItemId,
			releaseId: tradeProposalItems.releaseId,
			declaredQuality: tradeProposalItems.declaredQuality,
			conditionNotes: tradeProposalItems.conditionNotes,
			title: releases.title,
			artist: releases.artist,
			coverImageUrl: releases.coverImageUrl,
		})
		.from(tradeProposalItems)
		.leftJoin(releases, eq(tradeProposalItems.releaseId, releases.id))
		.where(inArray(tradeProposalItems.proposalId, proposalIds));

	// Step 4: group items by proposalId
	const itemsByProposal = new Map<string, ProposalItemData[]>();
	for (const item of items) {
		const list = itemsByProposal.get(item.proposalId) ?? [];
		list.push({
			id: item.id,
			side: item.side as "offer" | "want",
			collectionItemId: item.collectionItemId,
			releaseId: item.releaseId,
			declaredQuality: item.declaredQuality,
			conditionNotes: item.conditionNotes,
			title: item.title,
			artist: item.artist,
			coverImageUrl: item.coverImageUrl,
		});
		itemsByProposal.set(item.proposalId, list);
	}

	// Step 5: assemble final result
	return proposals.map((p) => ({
		id: p.id,
		proposerId: p.proposerId,
		sequenceNumber: p.sequenceNumber,
		status: p.status,
		message: p.message,
		createdAt: p.createdAt,
		items: itemsByProposal.get(p.id) ?? [],
	}));
}
