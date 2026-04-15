"use server";

import { and, eq, or } from "drizzle-orm";
import { z } from "zod";
import { requireUser } from "@/lib/auth/require-user";
import { db } from "@/lib/db";
import { tradeMessages, tradeRequests, tradeReviews } from "@/lib/db/schema/trades";
import { checkAndIncrementTradeCount } from "@/lib/entitlements";
import { safeLimit, tradeRateLimit } from "@/lib/rate-limit";
import { uuidSchema } from "@/lib/validations/common";

const createTradeSchema = z.object({
	providerId: uuidSchema,
	releaseId: uuidSchema.optional(),
	offeringReleaseId: uuidSchema.optional(),
	message: z.string().max(1000).trim().optional(),
});

// ---------------------------------------------------------------------------
// Valid status transitions for the web app.
//
// The desktop app manages the full lifecycle (lobby → previewing →
// transferring → completed) because those states require WebRTC.
// The web app handles the initial handshake: accept/decline/cancel.
// ---------------------------------------------------------------------------
const VALID_TRANSITIONS: Record<string, string[]> = {
	pending: ["accepted", "declined", "cancelled"],
	accepted: ["cancelled"], // allow cancel after accept but before lobby
	lobby: ["cancelled"], // allow cancel from lobby
};

/**
 * Validates that the caller is a participant in the trade and returns
 * the trade row + role context.
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
				or(eq(tradeRequests.requesterId, userId), eq(tradeRequests.providerId, userId)),
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
 * Inserts a system message into the trade thread to record a status change.
 */
async function insertSystemMessage(tradeId: string, senderId: string, body: string) {
	await db.insert(tradeMessages).values({
		tradeId,
		senderId,
		kind: "system",
		body,
	});
}

export async function initiateTradeAction(input: {
	providerId: string;
	releaseId?: string;
	offeringReleaseId?: string;
	message?: string;
}): Promise<{ tradeId: string } | { error: string; limitReached?: boolean }> {
	try {
		const user = await requireUser();

		// Rate limit: trade initiation is expensive — use stricter trade limiter
		const { success: rlSuccess } = await safeLimit(tradeRateLimit, user.id, true);
		if (!rlSuccess) {
			return { error: "Too many requests. Please wait a moment." };
		}

		const parsed = createTradeSchema.safeParse(input);
		if (!parsed.success) {
			return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
		}

		if (parsed.data.providerId === user.id) {
			return { error: "Cannot initiate a trade with yourself." };
		}

		// Return existing active trade instead of creating a duplicate
		const [existing] = await db
			.select({ id: tradeRequests.id })
			.from(tradeRequests)
			.where(
				and(
					or(
						and(
							eq(tradeRequests.requesterId, user.id),
							eq(tradeRequests.providerId, parsed.data.providerId),
						),
						and(
							eq(tradeRequests.requesterId, parsed.data.providerId),
							eq(tradeRequests.providerId, user.id),
						),
					),
					// Only reuse non-terminal trades
					or(
						eq(tradeRequests.status, "pending"),
						eq(tradeRequests.status, "accepted"),
						eq(tradeRequests.status, "lobby"),
					),
				),
			)
			.limit(1);

		if (existing) {
			return { tradeId: existing.id };
		}

		// Enforce quota before INSERT — atomic increment prevents TOCTOU race
		const entitlement = await checkAndIncrementTradeCount(user.id);
		if (!entitlement.allowed) {
			return {
				error: `Monthly trade limit reached (${entitlement.tradesLimit}/month). Upgrade to Premium for unlimited trades.`,
				limitReached: true,
			};
		}

		const [row] = await db
			.insert(tradeRequests)
			.values({
				requesterId: user.id,
				providerId: parsed.data.providerId,
				releaseId: parsed.data.releaseId ?? null,
				offeringReleaseId: parsed.data.offeringReleaseId ?? null,
				message: parsed.data.message ?? null,
				status: "pending",
			})
			.returning({ id: tradeRequests.id });

		if (!row) {
			return { error: "Failed to create trade request." };
		}

		return { tradeId: row.id };
	} catch (err) {
		console.error("[initiateTradeAction] error:", err);
		return { error: "Failed to initiate trade. Please try again." };
	}
}

// ---------------------------------------------------------------------------
// Accept trade — provider accepts a pending request
// ---------------------------------------------------------------------------

/**
 * Accept a pending trade request.
 *
 * Authorization: Only the provider can accept (the requester initiated it).
 * Transition: pending → accepted
 */
export async function acceptTradeAction(
	tradeId: string,
): Promise<{ success: boolean; error?: string }> {
	try {
		const user = await requireUser();

		const { success: rlSuccess } = await safeLimit(tradeRateLimit, user.id, true);
		if (!rlSuccess) {
			return { success: false, error: "Too many requests. Please wait a moment." };
		}

		const parsed = uuidSchema.safeParse(tradeId);
		if (!parsed.success) {
			return { success: false, error: "Invalid trade ID" };
		}

		const trade = await loadTradeForParticipant(parsed.data, user.id);
		if (!trade) {
			return { success: false, error: "Trade not found." };
		}

		// Only the provider can accept
		if (!trade.isProvider) {
			return { success: false, error: "Only the recipient can accept a trade request." };
		}

		// Validate status transition
		if (!VALID_TRANSITIONS[trade.status]?.includes("accepted")) {
			return { success: false, error: `Cannot accept a trade that is "${trade.status}".` };
		}

		await db
			.update(tradeRequests)
			.set({
				status: "accepted",
				updatedAt: new Date(),
			})
			.where(eq(tradeRequests.id, parsed.data));

		await insertSystemMessage(parsed.data, user.id, "Trade request accepted.");

		return { success: true };
	} catch (err) {
		console.error("[acceptTradeAction] error:", err);
		return { success: false, error: "Failed to accept trade. Please try again." };
	}
}

// ---------------------------------------------------------------------------
// Decline trade — provider declines a pending request
// ---------------------------------------------------------------------------

/**
 * Decline a pending trade request.
 *
 * Authorization: Only the provider can decline.
 * Transition: pending → declined
 */
export async function declineTradeAction(
	tradeId: string,
): Promise<{ success: boolean; error?: string }> {
	try {
		const user = await requireUser();

		const { success: rlSuccess } = await safeLimit(tradeRateLimit, user.id, true);
		if (!rlSuccess) {
			return { success: false, error: "Too many requests. Please wait a moment." };
		}

		const parsed = uuidSchema.safeParse(tradeId);
		if (!parsed.success) {
			return { success: false, error: "Invalid trade ID" };
		}

		const trade = await loadTradeForParticipant(parsed.data, user.id);
		if (!trade) {
			return { success: false, error: "Trade not found." };
		}

		// Only the provider can decline
		if (!trade.isProvider) {
			return { success: false, error: "Only the recipient can decline a trade request." };
		}

		if (!VALID_TRANSITIONS[trade.status]?.includes("declined")) {
			return { success: false, error: `Cannot decline a trade that is "${trade.status}".` };
		}

		await db
			.update(tradeRequests)
			.set({
				status: "declined",
				updatedAt: new Date(),
			})
			.where(eq(tradeRequests.id, parsed.data));

		await insertSystemMessage(parsed.data, user.id, "Trade request declined.");

		return { success: true };
	} catch (err) {
		console.error("[declineTradeAction] error:", err);
		return { success: false, error: "Failed to decline trade. Please try again." };
	}
}

// ---------------------------------------------------------------------------
// Cancel trade — either participant can cancel (non-terminal states only)
// ---------------------------------------------------------------------------

/**
 * Cancel a trade.
 *
 * Authorization: Either participant can cancel.
 * Transition: pending|accepted|lobby → cancelled
 */
export async function cancelTradeAction(
	tradeId: string,
): Promise<{ success: boolean; error?: string }> {
	try {
		const user = await requireUser();

		const { success: rlSuccess } = await safeLimit(tradeRateLimit, user.id, true);
		if (!rlSuccess) {
			return { success: false, error: "Too many requests. Please wait a moment." };
		}

		const parsed = uuidSchema.safeParse(tradeId);
		if (!parsed.success) {
			return { success: false, error: "Invalid trade ID" };
		}

		const trade = await loadTradeForParticipant(parsed.data, user.id);
		if (!trade) {
			return { success: false, error: "Trade not found." };
		}

		if (!VALID_TRANSITIONS[trade.status]?.includes("cancelled")) {
			return { success: false, error: `Cannot cancel a trade that is "${trade.status}".` };
		}

		await db
			.update(tradeRequests)
			.set({
				status: "cancelled",
				updatedAt: new Date(),
			})
			.where(eq(tradeRequests.id, parsed.data));

		await insertSystemMessage(parsed.data, user.id, "Trade cancelled.");

		return { success: true };
	} catch (err) {
		console.error("[cancelTradeAction] error:", err);
		return { success: false, error: "Failed to cancel trade. Please try again." };
	}
}

// ---------------------------------------------------------------------------
// Submit trade review — after a trade is completed
// ---------------------------------------------------------------------------

const submitReviewSchema = z.object({
	tradeId: uuidSchema,
	qualityRating: z.number().int().min(1).max(5),
	comment: z.string().max(2000).trim().optional(),
});

/**
 * Submit a review for a completed trade.
 *
 * Authorization: Both participants can review, but only for completed trades.
 * The reviewed user is automatically set to the counterparty.
 * One review per user per trade (upsert on conflict).
 */
export async function submitTradeReviewAction(input: {
	tradeId: string;
	qualityRating: number;
	comment?: string;
}): Promise<{ success: boolean; error?: string }> {
	try {
		const user = await requireUser();

		const { success: rlSuccess } = await safeLimit(tradeRateLimit, user.id, true);
		if (!rlSuccess) {
			return { success: false, error: "Too many requests. Please wait a moment." };
		}

		const parsed = submitReviewSchema.safeParse(input);
		if (!parsed.success) {
			return { success: false, error: parsed.error.issues[0]?.message ?? "Invalid input" };
		}

		const trade = await loadTradeForParticipant(parsed.data.tradeId, user.id);
		if (!trade) {
			return { success: false, error: "Trade not found." };
		}

		if (trade.status !== "completed") {
			return { success: false, error: "Can only review completed trades." };
		}

		// The reviewed user is the counterparty
		const reviewedId = trade.isRequester ? trade.providerId : trade.requesterId;

		// Check for existing review (one per reviewer per trade)
		const [existing] = await db
			.select({ id: tradeReviews.id })
			.from(tradeReviews)
			.where(
				and(eq(tradeReviews.tradeId, parsed.data.tradeId), eq(tradeReviews.reviewerId, user.id)),
			)
			.limit(1);

		if (existing) {
			// Update existing review
			await db
				.update(tradeReviews)
				.set({
					qualityRating: parsed.data.qualityRating,
					comment: parsed.data.comment ?? null,
				})
				.where(eq(tradeReviews.id, existing.id));
		} else {
			await db.insert(tradeReviews).values({
				tradeId: parsed.data.tradeId,
				reviewerId: user.id,
				reviewedId,
				qualityRating: parsed.data.qualityRating,
				comment: parsed.data.comment ?? null,
			});
		}

		return { success: true };
	} catch (err) {
		console.error("[submitTradeReviewAction] error:", err);
		return { success: false, error: "Failed to submit review. Please try again." };
	}
}

// ---------------------------------------------------------------------------
// DEV ONLY — force trade status (never call in production)
// ---------------------------------------------------------------------------

const DEV_ALLOWED_STATUSES = ["lobby", "previewing", "accepted", "transferring", "completed"] as const;

export async function devForceTradeStatusAction(
	tradeId: string,
	targetStatus: string,
): Promise<{ success: boolean; error?: string }> {
	if (process.env.NODE_ENV !== "development") {
		return { success: false, error: "Only available in development mode." };
	}

	const user = await requireUser();

	if (!DEV_ALLOWED_STATUSES.includes(targetStatus as (typeof DEV_ALLOWED_STATUSES)[number])) {
		return { success: false, error: `Invalid status: ${targetStatus}` };
	}

	const trade = await loadTradeForParticipant(tradeId, user.id);
	if (!trade) {
		return { success: false, error: "Trade not found." };
	}

	await db
		.update(tradeRequests)
		.set({ status: targetStatus, updatedAt: new Date() })
		.where(eq(tradeRequests.id, tradeId));

	return { success: true };
}
