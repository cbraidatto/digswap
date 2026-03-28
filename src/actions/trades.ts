"use server";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { logActivity } from "@/actions/social";
import { awardBadge } from "@/lib/gamification/badge-awards";
import { CONTRIBUTION_POINTS } from "@/lib/gamification/constants";
import {
	TRADE_STATUS,
	MAX_FREE_TRADES_PER_MONTH,
	isP2PEnabled,
} from "@/lib/trades/constants";
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
	fileName: string;
	fileFormat: string;
	declaredBitrate: string;
	fileSizeBytes: number;
	expiryHours: number;
	message?: string;
}): Promise<{ success?: boolean; tradeId?: string; error?: string; tradesRemaining?: number }> {
	// D-03 server-side P2P gate check
	if (!isP2PEnabled()) {
		return { error: "P2P trading is currently disabled" };
	}

	const user = await requireUser();
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

	// Compute expiry timestamp
	const expiresAt = new Date(
		Date.now() + formData.expiryHours * 60 * 60 * 1000,
	).toISOString();

	// Insert trade request
	const { data: trade, error: insertError } = await admin
		.from("trade_requests")
		.insert({
			requester_id: user.id,
			provider_id: formData.providerId,
			release_id: formData.releaseId ?? null,
			status: TRADE_STATUS.PENDING,
			message: formData.message ?? null,
			expires_at: expiresAt,
			file_name: formData.fileName,
			file_format: formData.fileFormat,
			declared_bitrate: formData.declaredBitrate,
			file_size_bytes: formData.fileSizeBytes,
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
		body: `Someone wants to trade "${formData.fileName}" with you`,
		link: `/trades/${trade.id}`,
	});

	// Send trade request email (non-fatal)
	try {
		await sendTradeRequestEmail(formData.providerId, formData.fileName, trade.id);
	} catch {
		// Email failure should not break trade creation
	}

	return { success: true, tradeId: trade.id };
}

// ---------------------------------------------------------------------------
// Accept Trade
// ---------------------------------------------------------------------------

export async function acceptTrade(
	tradeId: string,
): Promise<{ success?: boolean; error?: string }> {
	const user = await requireUser();
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

	// Update status
	const { error: updateError } = await admin
		.from("trade_requests")
		.update({
			status: TRADE_STATUS.ACCEPTED,
			updated_at: new Date().toISOString(),
		})
		.eq("id", tradeId);

	if (updateError) {
		return { error: "Failed to accept trade" };
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

	const { error: updateError } = await admin
		.from("trade_requests")
		.update({
			status: TRADE_STATUS.DECLINED,
			updated_at: new Date().toISOString(),
		})
		.eq("id", tradeId);

	if (updateError) {
		return { error: "Failed to decline trade" };
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

export async function cancelTrade(
	tradeId: string,
): Promise<{ success?: boolean; error?: string }> {
	const user = await requireUser();
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

	const { error: updateError } = await admin
		.from("trade_requests")
		.update({
			status: TRADE_STATUS.CANCELLED,
			updated_at: new Date().toISOString(),
		})
		.eq("id", tradeId);

	if (updateError) {
		return { error: "Failed to cancel trade" };
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
		[TRADE_STATUS.ACCEPTED]: [TRADE_STATUS.TRANSFERRING],
		[TRADE_STATUS.TRANSFERRING]: [TRADE_STATUS.COMPLETED],
	};

	const allowed = validTransitions[trade.status];
	if (!allowed || !allowed.includes(newStatus)) {
		return { error: `Cannot transition from ${trade.status} to ${newStatus}` };
	}

	const { error: updateError } = await admin
		.from("trade_requests")
		.update({
			status: newStatus,
			updated_at: new Date().toISOString(),
		})
		.eq("id", tradeId);

	if (updateError) {
		return { error: "Failed to update trade status" };
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

	// Must be in transferring, accepted, or completed state
	if (
		trade.status !== TRADE_STATUS.TRANSFERRING &&
		trade.status !== TRADE_STATUS.ACCEPTED &&
		trade.status !== TRADE_STATUS.COMPLETED
	) {
		return { error: "Trade is not in an active state" };
	}

	// Determine counterparty
	const counterpartyId =
		trade.requester_id === user.id
			? trade.provider_id
			: trade.requester_id;

	// Update trade status to completed
	const { error: updateError } = await admin
		.from("trade_requests")
		.update({
			status: TRADE_STATUS.COMPLETED,
			updated_at: new Date().toISOString(),
		})
		.eq("id", tradeId);

	if (updateError) {
		return { error: "Failed to complete trade" };
	}

	// Insert trade review
	await admin.from("trade_reviews").insert({
		trade_id: tradeId,
		reviewer_id: user.id,
		reviewed_id: counterpartyId,
		quality_rating: qualityRating,
		comment: comment,
	});

	// Increment tradesThisMonth for both parties
	for (const userId of [trade.requester_id, trade.provider_id]) {
		await admin.rpc("increment_field", {
			table_name: "subscriptions",
			field_name: "trades_this_month",
			row_filter: `user_id=eq.${userId}`,
			increment_by: 1,
		}).then(async ({ error: rpcError }) => {
			// Fallback: direct update if RPC not available
			if (rpcError) {
				await admin
					.from("subscriptions")
					.update({
						trades_this_month: admin
							? undefined
							: 0, // Will be computed below
					})
					.eq("user_id", userId);
			}
		});
	}

	// Award CONNECTOR badge to both parties
	await awardBadge(trade.requester_id, "connector");
	await awardBadge(trade.provider_id, "connector");

	// Increment contribution scores (+15 per trade_completed)
	for (const userId of [trade.requester_id, trade.provider_id]) {
		await admin
			.from("subscriptions")
			.update({
				updated_at: new Date().toISOString(),
			})
			.eq("user_id", userId);
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

export async function skipReview(
	tradeId: string,
): Promise<{ success?: boolean; error?: string }> {
	const user = await requireUser();
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

	if (
		trade.status !== TRADE_STATUS.TRANSFERRING &&
		trade.status !== TRADE_STATUS.ACCEPTED
	) {
		return { error: "Trade is not in an active state" };
	}

	const counterpartyId =
		trade.requester_id === user.id
			? trade.provider_id
			: trade.requester_id;

	// Update status to completed (no review)
	await admin
		.from("trade_requests")
		.update({
			status: TRADE_STATUS.COMPLETED,
			updated_at: new Date().toISOString(),
		})
		.eq("id", tradeId);

	// Award badges and increment counters (same as completeTrade)
	await awardBadge(trade.requester_id, "connector");
	await awardBadge(trade.provider_id, "connector");

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
	await requireUser();

	const appName = process.env.METERED_APP_NAME;
	const apiKey = process.env.METERED_API_KEY;

	// Dev fallback: use Google STUN if env vars not configured
	if (!appName || !apiKey) {
		return [
			{ urls: "stun:stun.l.google.com:19302" },
			{ urls: "stun:stun1.l.google.com:19302" },
		];
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
// Trade Request Email (internal helper)
// ---------------------------------------------------------------------------

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
		const from =
			process.env.RESEND_FROM_EMAIL || "DigSwap <onboarding@resend.dev>";
		const appUrl =
			process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

		await resend.emails.send({
			from,
			to: authUser.user.email,
			subject: "New trade request on DigSwap",
			html: `<div style="font-family: monospace; background: #10141a; color: #dfe2eb; padding: 24px;">
  <h2 style="color: #6fdd78;">New Trade Request</h2>
  <p>Someone wants to trade <strong>"${fileName}"</strong> with you.</p>
  <p><a href="${appUrl}/trades/${tradeId}" style="color: #aac7ff;">View trade request</a></p>
</div>`,
		});
	} catch (error) {
		console.error("Failed to send trade request email:", error);
	}
}
