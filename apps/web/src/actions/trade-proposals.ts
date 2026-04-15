"use server";

import { and, desc, eq, or } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireUser } from "@/lib/auth/require-user";
import { db } from "@/lib/db";
import { notifications } from "@/lib/db/schema/notifications";
import {
	tradeProposalItems,
	tradeProposals,
	tradeRequests,
} from "@/lib/db/schema/trades";
import { getUserSubscription, isPremium } from "@/lib/entitlements";
import { safeLimit, tradeRateLimit } from "@/lib/rate-limit";
import { uuidSchema } from "@/lib/validations/common";
import { createAdminClient } from "@/lib/supabase/admin";

// ---------------------------------------------------------------------------
// Zod schemas
// ---------------------------------------------------------------------------

const proposalItemSchema = z.object({
	collectionItemId: uuidSchema.optional(),
	releaseId: uuidSchema,
	declaredQuality: z.string().min(1, "Quality declaration is required").max(50),
	conditionNotes: z.string().max(500).optional(),
});

const createProposalSchema = z.object({
	tradeId: uuidSchema.optional(),
	targetUserId: uuidSchema,
	releaseId: uuidSchema.optional(),
	offerItems: z.array(proposalItemSchema).min(1).max(3),
	wantItems: z.array(proposalItemSchema).min(1).max(3),
	message: z.string().max(1000).trim().optional(),
});

const counterproposalSchema = z.object({
	tradeId: uuidSchema,
	offerItems: z.array(proposalItemSchema).min(1).max(3),
	wantItems: z.array(proposalItemSchema).min(1).max(3),
	message: z.string().max(1000).trim().optional(),
});

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const MAX_ROUNDS = 10;
const FREE_ITEMS_PER_SIDE = 1;
const PREMIUM_ITEMS_PER_SIDE = 3;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Validates the caller is a participant in the trade and returns trade + role.
 */
async function loadTradeForParticipant(tradeId: string, userId: string) {
	const [trade] = await db
		.select({
			id: tradeRequests.id,
			requesterId: tradeRequests.requesterId,
			providerId: tradeRequests.providerId,
			status: tradeRequests.status,
		})
		.from(tradeRequests)
		.where(
			and(
				eq(tradeRequests.id, tradeId),
				or(
					eq(tradeRequests.requesterId, userId),
					eq(tradeRequests.providerId, userId),
				),
			),
		)
		.limit(1);

	if (!trade) return null;

	return {
		...trade,
		isRequester: trade.requesterId === userId,
		isProvider: trade.providerId === userId,
	};
}

/**
 * Returns the maximum items per side based on the user's subscription tier.
 */
async function getMaxItemsPerSide(userId: string): Promise<number> {
	const subscription = await getUserSubscription(userId);
	const plan = subscription?.plan ?? "free";
	const status = subscription?.status ?? "active";

	return isPremium(plan, status) ? PREMIUM_ITEMS_PER_SIDE : FREE_ITEMS_PER_SIDE;
}

/**
 * Validates that all proposal items have declaredQuality set.
 */
function validateItemQuality(
	items: Array<{ declaredQuality: string }>,
): boolean {
	return items.every(
		(item) => item.declaredQuality && item.declaredQuality.trim().length > 0,
	);
}

/**
 * Inserts proposal items for a given proposal.
 */
async function insertProposalItems(
	proposalId: string,
	offerItems: Array<{
		collectionItemId?: string;
		releaseId: string;
		declaredQuality: string;
		conditionNotes?: string;
	}>,
	wantItems: Array<{
		collectionItemId?: string;
		releaseId: string;
		declaredQuality: string;
		conditionNotes?: string;
	}>,
) {
	const allItems = [
		...offerItems.map((item) => ({
			proposalId,
			side: "offer" as const,
			collectionItemId: item.collectionItemId ?? null,
			releaseId: item.releaseId,
			declaredQuality: item.declaredQuality,
			conditionNotes: item.conditionNotes ?? null,
		})),
		...wantItems.map((item) => ({
			proposalId,
			side: "want" as const,
			collectionItemId: item.collectionItemId ?? null,
			releaseId: item.releaseId,
			declaredQuality: item.declaredQuality,
			conditionNotes: item.conditionNotes ?? null,
		})),
	];

	for (const item of allItems) {
		await db.insert(tradeProposalItems).values(item);
	}
}

// ---------------------------------------------------------------------------
// createProposalAction
// ---------------------------------------------------------------------------

/**
 * Create the initial proposal for a trade.
 *
 * If tradeId is not provided, creates a new trade_requests row first.
 * Free users: 1 item per side. Premium: up to 3 per side.
 * All items must have a declared quality.
 */
export async function createProposalAction(input: {
	tradeId?: string;
	targetUserId: string;
	releaseId?: string;
	offerItems: Array<{
		collectionItemId?: string;
		releaseId: string;
		declaredQuality: string;
		conditionNotes?: string;
	}>;
	wantItems: Array<{
		collectionItemId?: string;
		releaseId: string;
		declaredQuality: string;
		conditionNotes?: string;
	}>;
	message?: string;
}): Promise<{ proposalId: string; tradeId: string } | { error: string }> {
	try {
		const user = await requireUser();

		// Rate limit
		const { success: rlSuccess } = await safeLimit(tradeRateLimit, user.id, true);
		if (!rlSuccess) {
			return { error: "Too many requests. Please wait a moment." };
		}

		const parsed = createProposalSchema.safeParse(input);
		if (!parsed.success) {
			return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
		}

		const { targetUserId, offerItems, wantItems, message } = parsed.data;

		if (targetUserId === user.id) {
			return { error: "Cannot create a proposal with yourself." };
		}

		// Validate quality declarations
		if (
			!validateItemQuality(offerItems) ||
			!validateItemQuality(wantItems)
		) {
			return { error: "All items must have a declared quality." };
		}

		// Tier enforcement
		const maxItems = await getMaxItemsPerSide(user.id);
		if (offerItems.length > maxItems || wantItems.length > maxItems) {
			return {
				error: `Free tier allows ${FREE_ITEMS_PER_SIDE} item per side. Upgrade to Premium for multi-item trades.`,
			};
		}

		// Create or use existing trade
		let tradeId = parsed.data.tradeId;
		if (!tradeId) {
			// Create new trade_requests row
			const [tradeRow] = await db
				.insert(tradeRequests)
				.values({
					requesterId: user.id,
					providerId: targetUserId,
					releaseId: wantItems[0]?.releaseId ?? null,
					offeringReleaseId: offerItems[0]?.releaseId ?? null,
					status: "pending",
					message: message ?? null,
				})
				.returning({ id: tradeRequests.id });

			if (!tradeRow) {
				return { error: "Failed to create trade request." };
			}
			tradeId = tradeRow.id;
		} else {
			// Verify participant
			const trade = await loadTradeForParticipant(tradeId, user.id);
			if (!trade) {
				return { error: "Trade not found." };
			}
		}

		// Insert proposal
		const [proposalRow] = await db
			.insert(tradeProposals)
			.values({
				tradeId,
				proposerId: user.id,
				sequenceNumber: 1,
				status: "pending",
				message: message ?? null,
			})
			.returning({ id: tradeProposals.id });

		if (!proposalRow) {
			return { error: "Failed to create proposal." };
		}

		// Insert items
		await insertProposalItems(proposalRow.id, offerItems, wantItems);

		return { proposalId: proposalRow.id, tradeId };
	} catch (err) {
		const errMsg = err instanceof Error ? err.message : "Unknown error";
		if (errMsg.includes("Not authenticated")) {
			return { error: "Not authenticated" };
		}
		console.error("[createProposalAction] error:", err);
		return { error: "Failed to create proposal. Please try again." };
	}
}

// ---------------------------------------------------------------------------
// createCounterproposalAction
// ---------------------------------------------------------------------------

/**
 * Create a counterproposal for an existing trade.
 *
 * Enforces:
 * - Turn order: caller must NOT be the last proposer
 * - Round limit: max 10 rounds
 * - Tier limits: same as createProposalAction
 * - Quality declarations: required on all items
 *
 * Supersedes previous pending proposal and inserts notification.
 */
export async function createCounterproposalAction(input: {
	tradeId: string;
	offerItems: Array<{
		collectionItemId?: string;
		releaseId: string;
		declaredQuality: string;
		conditionNotes?: string;
	}>;
	wantItems: Array<{
		collectionItemId?: string;
		releaseId: string;
		declaredQuality: string;
		conditionNotes?: string;
	}>;
	message?: string;
}): Promise<{ proposalId: string } | { error: string }> {
	try {
		const user = await requireUser();

		const { success: rlSuccess } = await safeLimit(tradeRateLimit, user.id, true);
		if (!rlSuccess) {
			return { error: "Too many requests. Please wait a moment." };
		}

		const parsed = counterproposalSchema.safeParse(input);
		if (!parsed.success) {
			return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
		}

		const { tradeId, offerItems, wantItems, message } = parsed.data;

		// Verify participant
		const trade = await loadTradeForParticipant(tradeId, user.id);
		if (!trade) {
			return { error: "Trade not found." };
		}

		// Validate quality
		if (
			!validateItemQuality(offerItems) ||
			!validateItemQuality(wantItems)
		) {
			return { error: "All items must have a declared quality." };
		}

		// Tier enforcement
		const maxItems = await getMaxItemsPerSide(user.id);
		if (offerItems.length > maxItems || wantItems.length > maxItems) {
			return {
				error: `Free tier allows ${FREE_ITEMS_PER_SIDE} item per side. Upgrade to Premium for multi-item trades.`,
			};
		}

		// Get latest proposal for turn + round checking
		const [latestProposal] = await db
			.select({
				id: tradeProposals.id,
				proposerId: tradeProposals.proposerId,
				sequenceNumber: tradeProposals.sequenceNumber,
				status: tradeProposals.status,
			})
			.from(tradeProposals)
			.where(eq(tradeProposals.tradeId, tradeId))
			.orderBy(desc(tradeProposals.sequenceNumber))
			.limit(1);

		if (!latestProposal) {
			return { error: "No existing proposal to counter." };
		}

		// Turn enforcement: caller must NOT be the last proposer
		if (latestProposal.proposerId === user.id) {
			return { error: "It is not your turn to propose." };
		}

		// Round cap
		if (latestProposal.sequenceNumber >= MAX_ROUNDS) {
			return {
				error: "Maximum of 10 counterproposal rounds reached.",
			};
		}

		// Supersede previous pending proposal
		await db
			.update(tradeProposals)
			.set({ status: "superseded", updatedAt: new Date() })
			.where(
				and(
					eq(tradeProposals.tradeId, tradeId),
					eq(tradeProposals.status, "pending"),
				),
			);

		// Insert new counterproposal
		const newSequence = latestProposal.sequenceNumber + 1;
		const [proposalRow] = await db
			.insert(tradeProposals)
			.values({
				tradeId,
				proposerId: user.id,
				sequenceNumber: newSequence,
				status: "pending",
				message: message ?? null,
			})
			.returning({ id: tradeProposals.id });

		if (!proposalRow) {
			return { error: "Failed to create counterproposal." };
		}

		// Insert items
		await insertProposalItems(proposalRow.id, offerItems, wantItems);

		// Insert notification for the other participant
		const otherUserId = trade.isRequester
			? trade.providerId
			: trade.requesterId;

		try {
			const admin = createAdminClient();
			await admin.from("notifications").insert({
				user_id: otherUserId,
				type: "counterproposal_received",
				title: "New counterproposal received",
				body: "Your trade partner has sent a counterproposal.",
				link: `/trades/${tradeId}`,
				read: false,
			});
		} catch (notifErr) {
			// Non-blocking: notification failure should not fail the action
			console.error("[createCounterproposalAction] notification error:", notifErr);
		}

		return { proposalId: proposalRow.id };
	} catch (err) {
		const errMsg = err instanceof Error ? err.message : "Unknown error";
		if (errMsg.includes("Not authenticated")) {
			return { error: "Not authenticated" };
		}
		console.error("[createCounterproposalAction] error:", err);
		return { error: "Failed to create counterproposal. Please try again." };
	}
}

// ---------------------------------------------------------------------------
// acceptProposalAction
// ---------------------------------------------------------------------------

/**
 * Accept a pending proposal.
 *
 * Only the OTHER participant (not the proposer) can accept.
 * Updates the proposal to 'accepted' and the parent trade to 'accepted'.
 */
export async function acceptProposalAction(
	proposalId: string,
): Promise<{ success: boolean; tradeId?: string; error?: string }> {
	try {
		const user = await requireUser();

		const { success: rlSuccess } = await safeLimit(tradeRateLimit, user.id, true);
		if (!rlSuccess) {
			return { success: false, error: "Too many requests. Please wait a moment." };
		}

		const parsed = uuidSchema.safeParse(proposalId);
		if (!parsed.success) {
			return { success: false, error: "Invalid proposal ID" };
		}

		// Fetch the proposal
		const [proposal] = await db
			.select({
				id: tradeProposals.id,
				tradeId: tradeProposals.tradeId,
				proposerId: tradeProposals.proposerId,
				status: tradeProposals.status,
			})
			.from(tradeProposals)
			.where(eq(tradeProposals.id, parsed.data))
			.limit(1);

		if (!proposal) {
			return { success: false, error: "Proposal not found." };
		}

		// Verify participant in parent trade
		const trade = await loadTradeForParticipant(proposal.tradeId, user.id);
		if (!trade) {
			return { success: false, error: "Trade not found." };
		}

		// Only the OTHER participant (not the proposer) can accept
		if (proposal.proposerId === user.id) {
			return { success: false, error: "Only the recipient can accept a proposal." };
		}

		// Must be pending
		if (proposal.status !== "pending") {
			return { success: false, error: "Only pending proposals can be accepted." };
		}

		// Update proposal status
		await db
			.update(tradeProposals)
			.set({ status: "accepted", updatedAt: new Date() })
			.where(eq(tradeProposals.id, parsed.data));

		// Update parent trade status to 'lobby' — next step is audio upload before preview
		await db
			.update(tradeRequests)
			.set({ status: "lobby", updatedAt: new Date() })
			.where(eq(tradeRequests.id, proposal.tradeId));

		revalidatePath(`/trades/${proposal.tradeId}`);
		return { success: true, tradeId: proposal.tradeId };
	} catch (err) {
		const errMsg = err instanceof Error ? err.message : "Unknown error";
		if (errMsg.includes("Not authenticated")) {
			return { success: false, error: "Not authenticated" };
		}
		console.error("[acceptProposalAction] error:", err);
		return { success: false, error: "Failed to accept proposal. Please try again." };
	}
}

// ---------------------------------------------------------------------------
// declineProposalAction
// ---------------------------------------------------------------------------

/**
 * Decline a pending proposal.
 *
 * Only the OTHER participant (not the proposer) can decline.
 * Updates the proposal to 'rejected' and the parent trade to 'declined'.
 */
export async function declineProposalAction(
	proposalId: string,
): Promise<{ success: boolean; error?: string }> {
	try {
		const user = await requireUser();

		const { success: rlSuccess } = await safeLimit(tradeRateLimit, user.id, true);
		if (!rlSuccess) {
			return { success: false, error: "Too many requests. Please wait a moment." };
		}

		const parsed = uuidSchema.safeParse(proposalId);
		if (!parsed.success) {
			return { success: false, error: "Invalid proposal ID" };
		}

		// Fetch the proposal
		const [proposal] = await db
			.select({
				id: tradeProposals.id,
				tradeId: tradeProposals.tradeId,
				proposerId: tradeProposals.proposerId,
				status: tradeProposals.status,
			})
			.from(tradeProposals)
			.where(eq(tradeProposals.id, parsed.data))
			.limit(1);

		if (!proposal) {
			return { success: false, error: "Proposal not found." };
		}

		// Verify participant in parent trade
		const trade = await loadTradeForParticipant(proposal.tradeId, user.id);
		if (!trade) {
			return { success: false, error: "Trade not found." };
		}

		// Only the OTHER participant (not the proposer) can decline
		if (proposal.proposerId === user.id) {
			return { success: false, error: "Only the recipient can decline a proposal." };
		}

		// Must be pending
		if (proposal.status !== "pending") {
			return { success: false, error: "Only pending proposals can be declined." };
		}

		// Update proposal status
		await db
			.update(tradeProposals)
			.set({ status: "rejected", updatedAt: new Date() })
			.where(eq(tradeProposals.id, parsed.data));

		// Update parent trade status
		await db
			.update(tradeRequests)
			.set({ status: "declined", updatedAt: new Date() })
			.where(eq(tradeRequests.id, proposal.tradeId));

		return { success: true };
	} catch (err) {
		const errMsg = err instanceof Error ? err.message : "Unknown error";
		if (errMsg.includes("Not authenticated")) {
			return { success: false, error: "Not authenticated" };
		}
		console.error("[declineProposalAction] error:", err);
		return { success: false, error: "Failed to decline proposal. Please try again." };
	}
}
