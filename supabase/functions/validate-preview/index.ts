import { createClient } from "npm:@supabase/supabase-js@2";
import {
	PREVIEW_BUCKET,
	parseMetadataNumber,
	validatePreviewMetadata,
} from "../_shared/preview-rules.ts";
import { corsHeaders, jsonResponse } from "../_shared/responses.ts";

const supabaseUrl = Deno.env.get("SUPABASE_URL");
const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

if (!supabaseUrl || !serviceRoleKey) {
	throw new Error("SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required.");
}

const admin = createClient(supabaseUrl, serviceRoleKey, {
	auth: {
		autoRefreshToken: false,
		persistSession: false,
	},
});

interface ValidationRequest {
	proposalItemId?: string;
	tradeId?: string;
}

interface ProposalItemRow {
	collection_item_id: string | null;
	preview_expires_at: string | null;
	preview_storage_path: string | null;
	proposal_id: string;
}

interface ProposalRow {
	trade_id: string;
}

interface TradeRow {
	provider_id: string;
	requester_id: string;
}

interface CollectionItemRow {
	audio_format: string | null;
	bitrate: number | null;
	sample_rate: number | null;
}

Deno.serve(async (request) => {
	if (request.method === "OPTIONS") {
		return new Response("ok", {
			headers: corsHeaders,
		});
	}

	if (request.method !== "POST") {
		return jsonResponse({ valid: false, errors: ["Method not allowed."] }, 405);
	}

	const authHeader = request.headers.get("Authorization");
	const accessToken = authHeader?.replace(/^Bearer\s+/i, "").trim();
	if (!accessToken) {
		return jsonResponse({ valid: false, errors: ["Missing bearer token."] }, 401);
	}

	const { data: authData, error: authError } = await admin.auth.getUser(accessToken);
	if (authError || !authData.user) {
		return jsonResponse({ valid: false, errors: ["Invalid session."] }, 401);
	}

	const payload = (await request.json().catch(() => null)) as ValidationRequest | null;
	if (!payload?.tradeId || !payload?.proposalItemId) {
		return jsonResponse(
			{ valid: false, errors: ["tradeId and proposalItemId are required."] },
			400,
		);
	}

	const { data: proposalItemData, error: proposalItemError } = await admin
		.from("trade_proposal_items")
		.select("proposal_id, collection_item_id, preview_storage_path, preview_expires_at")
		.eq("id", payload.proposalItemId)
		.single();

	if (proposalItemError || !proposalItemData) {
		return jsonResponse({ valid: false, errors: ["Preview item not found."] }, 404);
	}

	const proposalItem = proposalItemData as ProposalItemRow;
	const { data: proposalData, error: proposalError } = await admin
		.from("trade_proposals")
		.select("trade_id")
		.eq("id", proposalItem.proposal_id)
		.single();

	if (proposalError || !proposalData) {
		return jsonResponse({ valid: false, errors: ["Trade proposal not found."] }, 404);
	}

	const proposal = proposalData as ProposalRow;
	if (proposal.trade_id !== payload.tradeId) {
		return jsonResponse(
			{ valid: false, errors: ["Proposal item does not belong to the provided trade."] },
			400,
		);
	}

	const { data: tradeData, error: tradeError } = await admin
		.from("trade_requests")
		.select("requester_id, provider_id")
		.eq("id", payload.tradeId)
		.single();

	if (tradeError || !tradeData) {
		return jsonResponse({ valid: false, errors: ["Trade not found."] }, 404);
	}

	const trade = tradeData as TradeRow;
	if (authData.user.id !== trade.requester_id && authData.user.id !== trade.provider_id) {
		return jsonResponse({ valid: false, errors: ["You are not a participant in this trade."] }, 403);
	}

	if (!proposalItem.preview_storage_path) {
		return jsonResponse({ valid: false, errors: ["Preview has not been uploaded yet."] });
	}

	const { data: storageInfo, error: storageError } = await admin.storage
		.from(PREVIEW_BUCKET)
		.info(proposalItem.preview_storage_path);

	if (storageError || !storageInfo) {
		return jsonResponse(
			{ valid: false, errors: ["Preview file is missing from storage."] },
			200,
		);
	}

	let collectionItem: CollectionItemRow | null = null;
	if (proposalItem.collection_item_id) {
		const { data: collectionData, error: collectionError } = await admin
			.from("collection_items")
			.select("audio_format, bitrate, sample_rate")
			.eq("id", proposalItem.collection_item_id)
			.maybeSingle();

		if (collectionError) {
			return jsonResponse(
				{ valid: false, errors: [`Failed to load collection metadata: ${collectionError.message}`] },
				500,
			);
		}

		collectionItem = (collectionData as CollectionItemRow | null) ?? null;
	}

	const metadata = storageInfo.metadata ?? {};
	const errors = validatePreviewMetadata({
		bitrate: parseMetadataNumber(metadata["bitrate"]),
		collectionBitrate: collectionItem?.bitrate ?? null,
		collectionFormat: collectionItem?.audio_format ?? null,
		collectionSampleRate: collectionItem?.sample_rate ?? null,
		durationSeconds: parseMetadataNumber(metadata["duration_seconds"]),
		format:
			typeof metadata["format"] === "string"
				? metadata["format"]
				: typeof metadata["mimetype"] === "string"
					? metadata["mimetype"]
					: null,
		sampleRate: parseMetadataNumber(metadata["sample_rate"]),
	});

	if (proposalItem.preview_expires_at && new Date(proposalItem.preview_expires_at).getTime() <= Date.now()) {
		errors.push("Preview has already expired.");
	}

	const metadataExpiresAt =
		typeof metadata["expires_at"] === "string" ? metadata["expires_at"] : null;
	if (metadataExpiresAt && new Date(metadataExpiresAt).getTime() <= Date.now()) {
		errors.push("Preview storage metadata reports an expired object.");
	}

	return jsonResponse({
		valid: errors.length === 0,
		errors,
	});
});
