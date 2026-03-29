import { createAdminClient } from "@/lib/supabase/admin";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface TradeInboxRow {
	id: string;
	status: string;
	counterpartyUsername: string | null;
	counterpartyAvatarUrl: string | null;
	releaseTitle: string | null;
	releaseArtist: string | null;
	createdAt: string;
	qualityRating: number | null;
}

export interface TradeDetail {
	id: string;
	requesterId: string;
	providerId: string;
	releaseId: string | null;
	status: string;
	message: string | null;
	expiresAt: string | null;
	fileName: string | null;
	fileFormat: string | null;
	declaredBitrate: string | null;
	fileSizeBytes: number | null;
	createdAt: string;
	updatedAt: string;
	counterpartyUsername: string | null;
	counterpartyAvatarUrl: string | null;
	releaseTitle: string | null;
	releaseArtist: string | null;
	offeringReleaseId: string | null;
	conditionNotes: string | null;
	declaredQuality: string | null;
	fileHash: string | null;
	termsAcceptedAt: string | null;
	termsAcceptedByRecipientAt: string | null;
	previewAcceptedAt: string | null;
	previewAcceptedByRecipientAt: string | null;
	lastJoinedLobbyAt: string | null;
	offeringReleaseTitle: string | null;
	offeringReleaseArtist: string | null;
}

export interface TradeReputation {
	totalTrades: number;
	averageRating: number | null;
}

export interface TradeCountResult {
	count: number;
	resetDate: string | null;
	plan: string;
}

// ---------------------------------------------------------------------------
// Query Functions
// ---------------------------------------------------------------------------

/**
 * Returns trade inbox rows filtered by tab.
 * - "pending": status in [pending, accepted]
 * - "active": status = transferring
 * - "completed": status in [completed, declined, cancelled, expired]
 */
export async function getTradeInbox(
	userId: string,
	tab: "pending" | "active" | "completed",
): Promise<TradeInboxRow[]> {
	const admin = createAdminClient();

	const statusMap: Record<string, string[]> = {
		pending: ["pending", "lobby"],
		active: ["previewing", "accepted", "transferring"],
		completed: ["completed", "declined", "cancelled", "expired"],
	};

	const statuses = statusMap[tab];

	// Fetch trades where user is requester or provider
	const { data: trades, error } = await admin
		.from("trade_requests")
		.select("id, requester_id, provider_id, status, release_id, created_at")
		.or(`requester_id.eq.${userId},provider_id.eq.${userId}`)
		.in("status", statuses)
		.order("created_at", { ascending: false });

	if (error || !trades) {
		console.error("[getTradeInbox] Error:", error);
		return [];
	}

	// Enrich with counterparty info and release info
	const rows: TradeInboxRow[] = [];
	for (const trade of trades) {
		const counterpartyId =
			trade.requester_id === userId
				? trade.provider_id
				: trade.requester_id;

		// Fetch counterparty profile
		const { data: profile } = await admin
			.from("profiles")
			.select("username, avatar_url")
			.eq("id", counterpartyId)
			.single();

		// Fetch release info if available
		let releaseTitle: string | null = null;
		let releaseArtist: string | null = null;
		if (trade.release_id) {
			const { data: release } = await admin
				.from("releases")
				.select("title, artist")
				.eq("id", trade.release_id)
				.single();
			releaseTitle = release?.title ?? null;
			releaseArtist = release?.artist ?? null;
		}

		// Fetch quality rating from review (if exists)
		let qualityRating: number | null = null;
		if (trade.status === "completed") {
			const { data: review } = await admin
				.from("trade_reviews")
				.select("quality_rating")
				.eq("trade_id", trade.id)
				.eq("reviewed_id", userId)
				.maybeSingle();
			qualityRating = review?.quality_rating ?? null;
		}

		rows.push({
			id: trade.id,
			status: trade.status,
			counterpartyUsername: profile?.username ?? null,
			counterpartyAvatarUrl: profile?.avatar_url ?? null,
			releaseTitle,
			releaseArtist,
			createdAt: trade.created_at,
			qualityRating,
		});
	}

	return rows;
}

/**
 * Returns full trade detail by ID. Verifies the calling user is a participant
 * to prevent IDOR attacks.
 */
export async function getTradeById(
	tradeId: string,
	userId: string,
): Promise<TradeDetail | null> {
	const admin = createAdminClient();

	const { data: trade, error } = await admin
		.from("trade_requests")
		.select("*")
		.eq("id", tradeId)
		.single();

	if (error || !trade) {
		return null;
	}

	// IDOR prevention: verify user is participant
	if (trade.requester_id !== userId && trade.provider_id !== userId) {
		return null;
	}

	// Fetch counterparty profile
	const counterpartyId =
		trade.requester_id === userId
			? trade.provider_id
			: trade.requester_id;

	const { data: profile } = await admin
		.from("profiles")
		.select("username, avatar_url")
		.eq("id", counterpartyId)
		.single();

	// Fetch release info
	let releaseTitle: string | null = null;
	let releaseArtist: string | null = null;
	if (trade.release_id) {
		const { data: release } = await admin
			.from("releases")
			.select("title, artist")
			.eq("id", trade.release_id)
			.single();
		releaseTitle = release?.title ?? null;
		releaseArtist = release?.artist ?? null;
	}

	// Fetch offering release info
	let offeringReleaseTitle: string | null = null;
	let offeringReleaseArtist: string | null = null;
	if (trade.offering_release_id) {
		const { data: offeringRelease } = await admin
			.from("releases")
			.select("title, artist")
			.eq("id", trade.offering_release_id)
			.single();
		offeringReleaseTitle = offeringRelease?.title ?? null;
		offeringReleaseArtist = offeringRelease?.artist ?? null;
	}

	return {
		id: trade.id,
		requesterId: trade.requester_id,
		providerId: trade.provider_id,
		releaseId: trade.release_id,
		status: trade.status,
		message: trade.message,
		expiresAt: trade.expires_at,
		fileName: trade.file_name,
		fileFormat: trade.file_format,
		declaredBitrate: trade.declared_bitrate,
		fileSizeBytes: trade.file_size_bytes,
		createdAt: trade.created_at,
		updatedAt: trade.updated_at,
		counterpartyUsername: profile?.username ?? null,
		counterpartyAvatarUrl: profile?.avatar_url ?? null,
		releaseTitle,
		releaseArtist,
		offeringReleaseId: trade.offering_release_id,
		conditionNotes: trade.condition_notes,
		declaredQuality: trade.declared_quality,
		fileHash: trade.file_hash,
		termsAcceptedAt: trade.terms_accepted_at,
		termsAcceptedByRecipientAt: trade.terms_accepted_by_recipient_at,
		previewAcceptedAt: trade.preview_accepted_at,
		previewAcceptedByRecipientAt: trade.preview_accepted_by_recipient_at,
		lastJoinedLobbyAt: trade.last_joined_lobby_at,
		offeringReleaseTitle,
		offeringReleaseArtist,
	};
}

/**
 * Returns trade reputation for a user: total completed trades and average rating.
 */
export async function getTradeReputation(
	userId: string,
): Promise<TradeReputation> {
	const admin = createAdminClient();

	// Count total reviews where this user was reviewed
	const { data: reviews, error } = await admin
		.from("trade_reviews")
		.select("quality_rating")
		.eq("reviewed_id", userId);

	if (error || !reviews || reviews.length === 0) {
		return { totalTrades: 0, averageRating: null };
	}

	const totalTrades = reviews.length;
	const sum = reviews.reduce(
		(acc: number, r: { quality_rating: number }) => acc + r.quality_rating,
		0,
	);
	const averageRating = Math.round((sum / totalTrades) * 10) / 10;

	return { totalTrades, averageRating };
}

/**
 * Returns the number of trades this month for a user, with check-on-read
 * month rollover reset.
 */
export async function getTradeCountThisMonth(
	userId: string,
): Promise<TradeCountResult> {
	const admin = createAdminClient();

	const { data: sub, error } = await admin
		.from("subscriptions")
		.select("trades_this_month, trades_month_reset, plan")
		.eq("user_id", userId)
		.single();

	if (error || !sub) {
		// No subscription row = free tier, 0 trades
		return { count: 0, resetDate: null, plan: "free" };
	}

	// Check-on-read: if the stored reset date is in a different month, reset counter
	const now = new Date();
	const resetDate = sub.trades_month_reset
		? new Date(sub.trades_month_reset)
		: null;

	const needsReset =
		!resetDate ||
		resetDate.getUTCMonth() !== now.getUTCMonth() ||
		resetDate.getUTCFullYear() !== now.getUTCFullYear();

	if (needsReset) {
		const nowIso = now.toISOString();
		await admin
			.from("subscriptions")
			.update({
				trades_this_month: 0,
				trades_month_reset: nowIso,
				updated_at: nowIso,
			})
			.eq("user_id", userId);

		return { count: 0, resetDate: nowIso, plan: sub.plan };
	}

	return {
		count: sub.trades_this_month,
		resetDate: sub.trades_month_reset,
		plan: sub.plan,
	};
}
