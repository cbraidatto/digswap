"use server";

import { sql } from "drizzle-orm";
import { logActivity } from "@/actions/social";
import { db } from "@/lib/db";
import { awardBadge } from "@/lib/gamification/badge-awards";
import { CONTRIBUTION_POINTS } from "@/lib/gamification/constants";
import { tradeRateLimit } from "@/lib/rate-limit";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { isP2PEnabled, MAX_FREE_TRADES_PER_MONTH, TRADE_EXPIRY_HOURS, TRADE_STATUS } from "@/lib/trades/constants";
import { getTradeCountThisMonth } from "@/lib/trades/queries";

// ---------------------------------------------------------------------------
// Auth helper
// ---------------------------------------------------------------------------

async function requireUser() {
	const supabase = await createClient();
	const {
		data: { user },
	} = await supabase.auth.getUser();

	if (!user) {
		throw new Error("Not authenticated");
	}

	return user;
}

// ---------------------------------------------------------------------------
// Create Trade Request
// ---------------------------------------------------------------------------

export async function createTrade(formData: {
	providerId: string;
	releaseId?: string;
	offeringReleaseId: string;
	declaredQuality: string;
	conditionNotes: string;
	message?: string;
}): Promise<{ success?: boolean; tradeId?: string; error?: string; tradesRemaining?: number }> {
	// D-03 server-side P2P gate check
	if (!isP2PEnabled()) {
		return { error: "P2P trading is currently disabled" };
	}

	const user = await requireUser();

	const { success: rlSuccess } = await tradeRateLimit.limit(user.id);
	if (!rlSuccess) {
		return { error: "Too many requests. Please wait a moment." };
	}

	const admin = createAdminClient();

	// Check ToS acceptance
	const { data: profile } = await admin
		.from("profiles")
		.select("trades_tos_accepted_at")
		.eq("id", user.id)
		.single();

	if (!profile?.trades_tos_accepted_at) {
		return { error: "ToS not accepted" };
	}

	// Check trade quota for free users
	const tradeCount = await getTradeCountThisMonth(user.id);
	if (tradeCount.count >= MAX_FREE_TRADES_PER_MONTH && tradeCount.plan === "free") {
		return { error: "Trade quota reached", tradesRemaining: 0 };
	}

	// Validate new proposal fields (D-02, D-05)
	if (!formData.offeringReleaseId) {
		return { error: "You must select a release you're offering" };
	}
	if (!formData.conditionNotes || formData.conditionNotes.trim().length < 10) {
		return { error: "Condition notes must be at least 10 characters" };
	}
	if (!formData.declaredQuality || formData.declaredQuality.trim().length === 0) {
		return { error: "Declared quality is required" };
	}

	// Compute expiry timestamp
	const expiresAt = new Date(Date.now() + TRADE_EXPIRY_HOURS * 60 * 60 * 1000).toISOString();

	// Insert trade request — metadata only at proposal time (D-02)
	// File fields (file_name, file_format, declared_bitrate, file_size_bytes) are set in the lobby, not here
	const { data: trade, error: insertError } = await admin
		.from("trade_requests")
		.insert({
			requester_id: user.id,
			provider_id: formData.providerId,
			release_id: formData.releaseId || null,
			offering_release_id: formData.offeringReleaseId,
			declared_quality: formData.declaredQuality.trim(),
			condition_notes: formData.conditionNotes.trim(),
			status: "lobby",
			message: formData.message?.trim() || null,
			expires_at: expiresAt,
			terms_accepted_at: new Date().toISOString(),
		})
		.select("id")
		.single();

	if (insertError || !trade) {
		console.error("[createTrade] Insert error:", insertError);
		return { error: "Failed to create trade request" };
	}

	// Create notification for provider
	await admin.from("notifications").insert({
		user_id: formData.providerId,
		type: "trade_request",
		title: "New trade request",
		body: "Someone wants to trade with you",
		link: `/trades/${trade.id}`,
	});

	// Send trade request email (non-fatal)
	try {
		await sendTradeRequestEmail(formData.providerId, "trade offer", trade.id);
	} catch {
		// Email failure should not break trade creation
	}

	return { success: true, tradeId: trade.id };
}

// ---------------------------------------------------------------------------
// Accept Trade
// ---------------------------------------------------------------------------

export async function acceptTrade(tradeId: string): Promise<{ success?: boolean; error?: string }> {
	const user = await requireUser();

	const { success: rlSuccess } = await tradeRateLimit.limit(user.id);
	if (!rlSuccess) {
		return { error: "Too many requests. Please wait a moment." };
	}

	const admin = createAdminClient();

	// Fetch trade and verify user is provider
	const { data: trade, error } = await admin
		.from("trade_requests")
		.select("id, requester_id, provider_id, status, file_name")
		.eq("id", tradeId)
		.single();

	if (error || !trade) {
		return { error: "Trade not found" };
	}

	if (trade.provider_id !== user.id) {
		return { error: "Only the provider can accept a trade" };
	}

	if (trade.status !== TRADE_STATUS.PENDING) {
		return { error: "Trade is not in pending status" };
	}

	// Update status (optimistic concurrency: only if status unchanged)
	const { data: updated, error: updateError } = await admin
		.from("trade_requests")
		.update({
			status: TRADE_STATUS.ACCEPTED,
			updated_at: new Date().toISOString(),
		})
		.eq("id", tradeId)
		.eq("status", TRADE_STATUS.PENDING)
		.select("id")
		.single();

	if (updateError || !updated) {
		return { error: "Trade was modified by another request" };
	}

	// Notify requester
	await admin.from("notifications").insert({
		user_id: trade.requester_id,
		type: "trade_accepted",
		title: "Trade accepted",
		body: `Your trade request for "${trade.file_name}" was accepted`,
		link: `/trades/${tradeId}`,
	});

	return { success: true };
}

// ---------------------------------------------------------------------------
// Decline Trade
// ---------------------------------------------------------------------------

export async function declineTrade(
	tradeId: string,
): Promise<{ success?: boolean; error?: string }> {
	const user = await requireUser();

	const { success: rlSuccess } = await tradeRateLimit.limit(user.id);
	if (!rlSuccess) {
		return { error: "Too many requests. Please wait a moment." };
	}

	const admin = createAdminClient();

	const { data: trade, error } = await admin
		.from("trade_requests")
		.select("id, requester_id, provider_id, status, file_name")
		.eq("id", tradeId)
		.single();

	if (error || !trade) {
		return { error: "Trade not found" };
	}

	if (trade.provider_id !== user.id) {
		return { error: "Only the provider can decline a trade" };
	}

	if (trade.status !== TRADE_STATUS.PENDING) {
		return { error: "Trade is not in pending status" };
	}

	// Update status (optimistic concurrency: only if status unchanged)
	const { data: updated, error: updateError } = await admin
		.from("trade_requests")
		.update({
			status: TRADE_STATUS.DECLINED,
			updated_at: new Date().toISOString(),
		})
		.eq("id", tradeId)
		.eq("status", TRADE_STATUS.PENDING)
		.select("id")
		.single();

	if (updateError || !updated) {
		return { error: "Trade was modified by another request" };
	}

	// Notify requester
	await admin.from("notifications").insert({
		user_id: trade.requester_id,
		type: "trade_declined",
		title: "Trade declined",
		body: `Your trade request for "${trade.file_name}" was declined`,
		link: `/trades/${tradeId}`,
	});

	return { success: true };
}

// ---------------------------------------------------------------------------
// Cancel Trade
// ---------------------------------------------------------------------------

export async function cancelTrade(tradeId: string): Promise<{ success?: boolean; error?: string }> {
	const user = await requireUser();

	const { success: rlSuccess } = await tradeRateLimit.limit(user.id);
	if (!rlSuccess) {
		return { error: "Too many requests. Please wait a moment." };
	}

	const admin = createAdminClient();

	const { data: trade, error } = await admin
		.from("trade_requests")
		.select("id, requester_id, provider_id, status, file_name")
		.eq("id", tradeId)
		.single();

	if (error || !trade) {
		return { error: "Trade not found" };
	}

	if (trade.requester_id !== user.id) {
		return { error: "Only the requester can cancel a trade" };
	}

	if (trade.status !== TRADE_STATUS.PENDING) {
		return { error: "Trade is not in pending status" };
	}

	// Update status (optimistic concurrency: only if status unchanged)
	const { data: updated, error: updateError } = await admin
		.from("trade_requests")
		.update({
			status: TRADE_STATUS.CANCELLED,
			updated_at: new Date().toISOString(),
		})
		.eq("id", tradeId)
		.eq("status", TRADE_STATUS.PENDING)
		.select("id")
		.single();

	if (updateError || !updated) {
		return { error: "Trade was modified by another request" };
	}

	// Notify provider
	await admin.from("notifications").insert({
		user_id: trade.provider_id,
		type: "trade_cancelled",
		title: "Trade cancelled",
		body: `A trade request for "${trade.file_name}" was cancelled`,
		link: `/trades/${tradeId}`,
	});

	return { success: true };
}

// ---------------------------------------------------------------------------
// Update Trade Status (lobby transitions)
// ---------------------------------------------------------------------------

export async function updateTradeStatus(
	tradeId: string,
	newStatus: string,
): Promise<{ success?: boolean; error?: string }> {
	const user = await requireUser();

	const { success: rlSuccess } = await tradeRateLimit.limit(user.id);
	if (!rlSuccess) {
		return { error: "Too many requests. Please wait a moment." };
	}

	const admin = createAdminClient();

	const { data: trade, error } = await admin
		.from("trade_requests")
		.select("id, requester_id, provider_id, status")
		.eq("id", tradeId)
		.single();

	if (error || !trade) {
		return { error: "Trade not found" };
	}

	// Verify participant
	if (trade.requester_id !== user.id && trade.provider_id !== user.id) {
		return { error: "Not a participant in this trade" };
	}

	// Validate state transitions
	const validTransitions: Record<string, string[]> = {
		[TRADE_STATUS.LOBBY]: [TRADE_STATUS.PREVIEWING],
		[TRADE_STATUS.PREVIEWING]: [TRADE_STATUS.TRANSFERRING],
		[TRADE_STATUS.ACCEPTED]: [TRADE_STATUS.TRANSFERRING],
		[TRADE_STATUS.TRANSFERRING]: [TRADE_STATUS.COMPLETED],
	};

	const allowed = validTransitions[trade.status];
	if (!allowed || !allowed.includes(newStatus)) {
		return { error: `Cannot transition from ${trade.status} to ${newStatus}` };
	}

	// Update status (optimistic concurrency: only if status unchanged)
	const { data: updated, error: updateError } = await admin
		.from("trade_requests")
		.update({
			status: newStatus,
			updated_at: new Date().toISOString(),
		})
		.eq("id", tradeId)
		.eq("status", trade.status)
		.select("id")
		.single();

	if (updateError || !updated) {
		return { error: "Trade was modified by another request" };
	}

	return { success: true };
}

// ---------------------------------------------------------------------------
// Complete Trade (with review)
// ---------------------------------------------------------------------------

export async function completeTrade(
	tradeId: string,
	qualityRating: number,
	comment: string | null,
): Promise<{ success?: boolean; error?: string }> {
	const user = await requireUser();

	const { success: rlSuccess } = await tradeRateLimit.limit(user.id);
	if (!rlSuccess) {
		return { error: "Too many requests. Please wait a moment." };
	}

	const admin = createAdminClient();

	// Validate rating
	if (qualityRating < 1 || qualityRating > 5) {
		return { error: "Quality rating must be between 1 and 5" };
	}

	const { data: trade, error } = await admin
		.from("trade_requests")
		.select("id, requester_id, provider_id, status")
		.eq("id", tradeId)
		.single();

	if (error || !trade) {
		return { error: "Trade not found" };
	}

	// Verify participant
	if (trade.requester_id !== user.id && trade.provider_id !== user.id) {
		return { error: "Not a participant in this trade" };
	}

	// Must be in transferring, previewing, or completed state (D-10: ACCEPTED removed, PREVIEWING added)
	if (
		trade.status !== TRADE_STATUS.TRANSFERRING &&
		trade.status !== TRADE_STATUS.PREVIEWING &&
		trade.status !== TRADE_STATUS.COMPLETED
	) {
		return { error: "Trade is not in an active state" };
	}

	// Determine counterparty
	const counterpartyId = trade.requester_id === user.id ? trade.provider_id : trade.requester_id;

	// Check for duplicate review before inserting
	const { data: existingReview } = await admin
		.from("trade_reviews")
		.select("id")
		.eq("trade_id", tradeId)
		.eq("reviewer_id", user.id)
		.maybeSingle();

	if (existingReview) {
		return { error: "You have already reviewed this trade" };
	}

	// Update trade status to completed (optimistic concurrency: only if status unchanged)
	const { data: updated, error: updateError } = await admin
		.from("trade_requests")
		.update({
			status: TRADE_STATUS.COMPLETED,
			updated_at: new Date().toISOString(),
		})
		.eq("id", tradeId)
		.eq("status", trade.status)
		.select("id")
		.single();

	if (updateError || !updated) {
		return { error: "Trade was already completed or modified by another request" };
	}

	// Insert trade review
	await admin.from("trade_reviews").insert({
		trade_id: tradeId,
		reviewer_id: user.id,
		reviewed_id: counterpartyId,
		quality_rating: qualityRating,
		comment: comment,
	});

	// Atomic increment tradesThisMonth for both parties (no read-increment-write race)
	for (const userId of [trade.requester_id, trade.provider_id]) {
		await db.execute(
			sql`UPDATE subscriptions SET trades_this_month = COALESCE(trades_this_month, 0) + 1, updated_at = NOW() WHERE user_id = ${userId}`,
		);
	}

	// Award CONNECTOR badge to both parties
	await awardBadge(trade.requester_id, "connector");
	await awardBadge(trade.provider_id, "connector");

	// Atomic increment contribution scores (+15 per trade_completed) in user_rankings
	for (const userId of [trade.requester_id, trade.provider_id]) {
		await db.execute(
			sql`UPDATE user_rankings SET contribution_score = COALESCE(contribution_score, 0) + ${CONTRIBUTION_POINTS.trade_completed}, updated_at = NOW() WHERE user_id = ${userId}`,
		);
	}

	// Log activity
	await logActivity(user.id, "completed_trade", "trade", tradeId, {
		counterpartyId,
		qualityRating,
		points: CONTRIBUTION_POINTS.trade_completed,
	});

	// Notify counterparty
	await admin.from("notifications").insert({
		user_id: counterpartyId,
		type: "trade_completed",
		title: "Trade completed",
		body: `A trade has been completed and reviewed (${qualityRating}/5)`,
		link: `/trades/${tradeId}`,
	});

	return { success: true };
}

// ---------------------------------------------------------------------------
// Skip Review (complete without review)
// ---------------------------------------------------------------------------

export async function skipReview(tradeId: string): Promise<{ success?: boolean; error?: string }> {
	const user = await requireUser();

	const { success: rlSuccess } = await tradeRateLimit.limit(user.id);
	if (!rlSuccess) {
		return { error: "Too many requests. Please wait a moment." };
	}

	const admin = createAdminClient();

	const { data: trade, error } = await admin
		.from("trade_requests")
		.select("id, requester_id, provider_id, status")
		.eq("id", tradeId)
		.single();

	if (error || !trade) {
		return { error: "Trade not found" };
	}

	// Verify participant
	if (trade.requester_id !== user.id && trade.provider_id !== user.id) {
		return { error: "Not a participant in this trade" };
	}

	if (trade.status !== TRADE_STATUS.TRANSFERRING && trade.status !== TRADE_STATUS.PREVIEWING) {
		return { error: "Trade is not in an active state" };
	}

	const counterpartyId = trade.requester_id === user.id ? trade.provider_id : trade.requester_id;

	// Update status to completed (optimistic concurrency: only if status unchanged)
	const { data: updated, error: updateError } = await admin
		.from("trade_requests")
		.update({
			status: TRADE_STATUS.COMPLETED,
			updated_at: new Date().toISOString(),
		})
		.eq("id", tradeId)
		.eq("status", trade.status)
		.select("id")
		.single();

	if (updateError || !updated) {
		return { error: "Trade was already completed or modified by another request" };
	}

	// Award badges and increment counters (same as completeTrade)
	await awardBadge(trade.requester_id, "connector");
	await awardBadge(trade.provider_id, "connector");

	// Atomic increment tradesThisMonth for both parties (no read-increment-write race)
	for (const userId of [trade.requester_id, trade.provider_id]) {
		await db.execute(
			sql`UPDATE subscriptions SET trades_this_month = COALESCE(trades_this_month, 0) + 1, updated_at = NOW() WHERE user_id = ${userId}`,
		);
	}

	// Atomic increment contribution scores in user_rankings
	for (const userId of [trade.requester_id, trade.provider_id]) {
		await db.execute(
			sql`UPDATE user_rankings SET contribution_score = COALESCE(contribution_score, 0) + ${CONTRIBUTION_POINTS.trade_completed}, updated_at = NOW() WHERE user_id = ${userId}`,
		);
	}

	await logActivity(user.id, "completed_trade", "trade", tradeId, {
		counterpartyId,
		skippedReview: true,
		points: CONTRIBUTION_POINTS.trade_completed,
	});

	return { success: true };
}

// ---------------------------------------------------------------------------
// Get TURN Credentials (D-09)
// ---------------------------------------------------------------------------

interface RTCIceServer {
	urls: string | string[];
	username?: string;
	credential?: string;
}

export async function getTurnCredentials(): Promise<RTCIceServer[]> {
	const user = await requireUser();

	const { success: rlSuccess } = await tradeRateLimit.limit(user.id);
	if (!rlSuccess) {
		throw new Error("Too many requests. Please wait a moment.");
	}

	const appName = process.env.METERED_APP_NAME;
	const apiKey = process.env.METERED_API_KEY;

	// Dev fallback: use Google STUN if env vars not configured
	if (!appName || !apiKey) {
		return [{ urls: "stun:stun.l.google.com:19302" }, { urls: "stun:stun1.l.google.com:19302" }];
	}

	const response = await fetch(
		`https://${appName}.metered.live/api/v1/turn/credentials?apiKey=${apiKey}`,
	);

	if (!response.ok) {
		throw new Error(`Failed to fetch TURN credentials: ${response.status}`);
	}

	const iceServers: RTCIceServer[] = await response.json();
	return iceServers;
}

// ---------------------------------------------------------------------------
// Accept ToS
// ---------------------------------------------------------------------------

export async function acceptToS(): Promise<{ success?: boolean; error?: string }> {
	const user = await requireUser();

	const { success: rlSuccess } = await tradeRateLimit.limit(user.id);
	if (!rlSuccess) {
		return { error: "Too many requests. Please wait a moment." };
	}

	const admin = createAdminClient();

	const { error } = await admin
		.from("profiles")
		.update({
			trades_tos_accepted_at: new Date().toISOString(),
		})
		.eq("id", user.id);

	if (error) {
		return { error: "Failed to accept Terms of Service" };
	}

	return { success: true };
}

// ---------------------------------------------------------------------------
// Get Trades Remaining
// ---------------------------------------------------------------------------

export async function getTradesRemaining(): Promise<{
	remaining: number;
	total: number;
	plan: string;
}> {
	const user = await requireUser();

	const { success: rlSuccess } = await tradeRateLimit.limit(user.id);
	if (!rlSuccess) {
		throw new Error("Too many requests. Please wait a moment.");
	}

	const tradeCount = await getTradeCountThisMonth(user.id);

	if (tradeCount.plan !== "free") {
		return { remaining: Infinity, total: Infinity, plan: tradeCount.plan };
	}

	return {
		remaining: Math.max(0, MAX_FREE_TRADES_PER_MONTH - tradeCount.count),
		total: MAX_FREE_TRADES_PER_MONTH,
		plan: tradeCount.plan,
	};
}

// ---------------------------------------------------------------------------
// Get Actionable Trade Count (for AppHeader badge)
// ---------------------------------------------------------------------------

export async function getActionableTradeCount(): Promise<number> {
	const supabase = await createClient();
	const {
		data: { user },
	} = await supabase.auth.getUser();

	if (!user) return 0;

	const admin = createAdminClient();

	// Count pending trades where user is provider (needs accept/decline)
	const { count: pendingCount } = await admin
		.from("trade_requests")
		.select("id", { count: "exact", head: true })
		.eq("provider_id", user.id)
		.eq("status", TRADE_STATUS.PENDING);

	// Count active trades (accepted/transferring) where user is participant
	const { count: activeCount } = await admin
		.from("trade_requests")
		.select("id", { count: "exact", head: true })
		.or(`requester_id.eq.${user.id},provider_id.eq.${user.id}`)
		.in("status", [TRADE_STATUS.ACCEPTED, TRADE_STATUS.TRANSFERRING]);

	return (pendingCount ?? 0) + (activeCount ?? 0);
}

// ---------------------------------------------------------------------------
// Accept Terms (negotiation phase)
// ---------------------------------------------------------------------------

export async function acceptTerms(
	tradeId: string,
): Promise<{ success?: boolean; error?: string; bothAccepted?: boolean }> {
	const user = await requireUser();

	const { success: rlSuccess } = await tradeRateLimit.limit(user.id);
	if (!rlSuccess) {
		return { error: "Too many requests. Please wait a moment." };
	}

	const admin = createAdminClient();

	const { data: trade, error } = await admin
		.from("trade_requests")
		.select("id, requester_id, provider_id, status, terms_accepted_at, terms_accepted_by_recipient_at")
		.eq("id", tradeId)
		.single();

	if (error || !trade) {
		return { error: "Trade not found" };
	}

	if (trade.requester_id !== user.id && trade.provider_id !== user.id) {
		return { error: "Not a participant in this trade" };
	}

	if (trade.status !== TRADE_STATUS.LOBBY) {
		return { error: "Trade is not in lobby phase" };
	}

	// Determine which timestamp to set based on role
	const isRequester = trade.requester_id === user.id;
	const updateField = isRequester ? "terms_accepted_at" : "terms_accepted_by_recipient_at";

	const { error: updateError } = await admin
		.from("trade_requests")
		.update({
			[updateField]: new Date().toISOString(),
			updated_at: new Date().toISOString(),
		})
		.eq("id", tradeId)
		.eq("status", TRADE_STATUS.LOBBY);

	if (updateError) {
		return { error: "Failed to accept terms" };
	}

	// Check if both have now accepted
	const otherField = isRequester ? "terms_accepted_by_recipient_at" : "terms_accepted_at";
	const otherAlreadyAccepted = trade[otherField] !== null;

	if (otherAlreadyAccepted) {
		// Both accepted: advance status to previewing
		await admin
			.from("trade_requests")
			.update({
				status: TRADE_STATUS.PREVIEWING,
				updated_at: new Date().toISOString(),
			})
			.eq("id", tradeId)
			.eq("status", TRADE_STATUS.LOBBY);

		return { success: true, bothAccepted: true };
	}

	return { success: true, bothAccepted: false };
}

// ---------------------------------------------------------------------------
// Decline Terms (negotiation phase)
// ---------------------------------------------------------------------------

export async function declineTerms(
	tradeId: string,
): Promise<{ success?: boolean; error?: string }> {
	const user = await requireUser();

	const { success: rlSuccess } = await tradeRateLimit.limit(user.id);
	if (!rlSuccess) {
		return { error: "Too many requests. Please wait a moment." };
	}

	const admin = createAdminClient();

	const { data: trade, error } = await admin
		.from("trade_requests")
		.select("id, requester_id, provider_id, status")
		.eq("id", tradeId)
		.single();

	if (error || !trade) {
		return { error: "Trade not found" };
	}

	if (trade.requester_id !== user.id && trade.provider_id !== user.id) {
		return { error: "Not a participant in this trade" };
	}

	if (trade.status !== TRADE_STATUS.LOBBY) {
		return { error: "Trade is not in lobby phase" };
	}

	const { error: updateError } = await admin
		.from("trade_requests")
		.update({
			status: TRADE_STATUS.DECLINED,
			updated_at: new Date().toISOString(),
		})
		.eq("id", tradeId)
		.eq("status", TRADE_STATUS.LOBBY);

	if (updateError) {
		return { error: "Failed to decline terms" };
	}

	return { success: true };
}

// ---------------------------------------------------------------------------
// Update File Hash (D-09: SHA-256 saved to DB during preview selection)
// ---------------------------------------------------------------------------

export async function updateFileHash(
	tradeId: string,
	hash: string,
): Promise<{ error?: string }> {
	const user = await requireUser();
	const admin = createAdminClient();

	await admin
		.from("trade_requests")
		.update({ file_hash: hash, updated_at: new Date().toISOString() })
		.eq("id", tradeId)
		.or(`requester_id.eq.${user.id},provider_id.eq.${user.id}`);

	return {};
}

// ---------------------------------------------------------------------------
// Accept Preview (bilateral preview acceptance gates full transfer)
// ---------------------------------------------------------------------------

export async function acceptPreview(
	tradeId: string,
): Promise<{ success?: boolean; error?: string; bothAccepted?: boolean }> {
	const user = await requireUser();

	const { success: rlSuccess } = await tradeRateLimit.limit(user.id);
	if (!rlSuccess) {
		return { error: "Too many requests. Please wait a moment." };
	}

	const admin = createAdminClient();

	const { data: trade, error } = await admin
		.from("trade_requests")
		.select(
			"id, requester_id, provider_id, status, preview_accepted_at, preview_accepted_by_recipient_at, terms_accepted_at, terms_accepted_by_recipient_at",
		)
		.eq("id", tradeId)
		.single();

	if (error || !trade) {
		return { error: "Trade not found" };
	}

	if (trade.requester_id !== user.id && trade.provider_id !== user.id) {
		return { error: "Not a participant in this trade" };
	}

	if (trade.status !== TRADE_STATUS.PREVIEWING) {
		return { error: "Trade is not in preview phase" };
	}

	const isRequester = trade.requester_id === user.id;
	const updateField = isRequester
		? "preview_accepted_at"
		: "preview_accepted_by_recipient_at";

	await admin
		.from("trade_requests")
		.update({
			[updateField]: new Date().toISOString(),
			updated_at: new Date().toISOString(),
		})
		.eq("id", tradeId)
		.eq("status", TRADE_STATUS.PREVIEWING);

	// Check if ALL 4 bilateral timestamps are now set (D-07)
	const otherPreviewField = isRequester
		? "preview_accepted_by_recipient_at"
		: "preview_accepted_at";
	const allFourSet =
		trade.terms_accepted_at !== null &&
		trade.terms_accepted_by_recipient_at !== null &&
		trade[otherPreviewField] !== null; // The other party already accepted

	if (allFourSet) {
		await admin
			.from("trade_requests")
			.update({
				status: TRADE_STATUS.TRANSFERRING,
				updated_at: new Date().toISOString(),
			})
			.eq("id", tradeId)
			.eq("status", TRADE_STATUS.PREVIEWING);

		return { success: true, bothAccepted: true };
	}

	return { success: true, bothAccepted: false };
}

// ---------------------------------------------------------------------------
// Reject Preview (cancels the trade)
// ---------------------------------------------------------------------------

export async function rejectPreview(
	tradeId: string,
): Promise<{ success?: boolean; error?: string }> {
	const user = await requireUser();

	const { success: rlSuccess } = await tradeRateLimit.limit(user.id);
	if (!rlSuccess) {
		return { error: "Too many requests. Please wait a moment." };
	}

	const admin = createAdminClient();

	const { data: trade, error } = await admin
		.from("trade_requests")
		.select("id, requester_id, provider_id, status")
		.eq("id", tradeId)
		.single();

	if (error || !trade) {
		return { error: "Trade not found" };
	}

	if (trade.requester_id !== user.id && trade.provider_id !== user.id) {
		return { error: "Not a participant in this trade" };
	}

	if (trade.status !== TRADE_STATUS.PREVIEWING) {
		return { error: "Trade is not in preview phase" };
	}

	await admin
		.from("trade_requests")
		.update({
			status: TRADE_STATUS.CANCELLED,
			updated_at: new Date().toISOString(),
		})
		.eq("id", tradeId)
		.eq("status", TRADE_STATUS.PREVIEWING);

	return { success: true };
}

// ---------------------------------------------------------------------------
// Update Last Joined Lobby (audit timestamp)
// ---------------------------------------------------------------------------

export async function updateLastJoinedLobby(tradeId: string): Promise<void> {
	const user = await requireUser();
	const admin = createAdminClient();
	await admin
		.from("trade_requests")
		.update({ last_joined_lobby_at: new Date().toISOString() })
		.eq("id", tradeId)
		.or(`requester_id.eq.${user.id},provider_id.eq.${user.id}`);
}

// ---------------------------------------------------------------------------
// Trade Request Email (internal helper)
// ---------------------------------------------------------------------------

function escapeHtml(unsafe: string): string {
	return unsafe
		.replace(/&/g, "&amp;")
		.replace(/</g, "&lt;")
		.replace(/>/g, "&gt;")
		.replace(/"/g, "&quot;")
		.replace(/'/g, "&#039;");
}

async function sendTradeRequestEmail(
	providerId: string,
	fileName: string,
	tradeId: string,
): Promise<void> {
	try {
		if (!process.env.RESEND_API_KEY) return;

		const admin = createAdminClient();

		// Get provider email from auth
		const { data: authUser } = await admin.auth.admin.getUserById(providerId);
		if (!authUser?.user?.email) return;

		const { Resend } = await import("resend");
		const resend = new Resend(process.env.RESEND_API_KEY);
		const from = process.env.RESEND_FROM_EMAIL || "DigSwap <onboarding@resend.dev>";
		const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

		const safeFileName = escapeHtml(fileName);
		const safeTradeId = escapeHtml(tradeId);

		await resend.emails.send({
			from,
			to: authUser.user.email,
			subject: "New trade request on DigSwap",
			html: `<div style="font-family: monospace; background: #10141a; color: #dfe2eb; padding: 24px;">
  <h2 style="color: #6fdd78;">New Trade Request</h2>
  <p>Someone wants to trade <strong>"${safeFileName}"</strong> with you.</p>
  <p><a href="${appUrl}/trades/${safeTradeId}" style="color: #aac7ff;">View trade request</a></p>
</div>`,
		});
	} catch (error) {
		console.error("Failed to send trade request email:", error);
	}
}
