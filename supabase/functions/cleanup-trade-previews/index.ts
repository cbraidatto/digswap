import { createClient } from "npm:@supabase/supabase-js@2";
import { PREVIEW_BUCKET } from "../_shared/preview-rules.ts";
import { jsonResponse } from "../_shared/responses.ts";

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

interface ExpiredPreviewRow {
	id: string;
	preview_storage_path: string | null;
}

Deno.serve(async (request) => {
	if (request.method === "OPTIONS") {
		return jsonResponse({ ok: true });
	}

	if (request.method !== "POST") {
		return jsonResponse({ error: "Method not allowed" }, 405);
	}

	const nowIso = new Date().toISOString();
	const { data, error } = await admin
		.from("trade_proposal_items")
		.select("id, preview_storage_path")
		.not("preview_storage_path", "is", null)
		.not("preview_expires_at", "is", null)
		.lte("preview_expires_at", nowIso)
		.limit(500);

	if (error) {
		return jsonResponse(
			{ deleted: 0, error: `Failed to query expired previews: ${error.message}` },
			500,
		);
	}

	const expiredRows = ((data ?? []) as ExpiredPreviewRow[]).filter(
		(row): row is ExpiredPreviewRow & { preview_storage_path: string } =>
			typeof row.preview_storage_path === "string" && row.preview_storage_path.length > 0,
	);

	if (expiredRows.length === 0) {
		return jsonResponse({ deleted: 0, bucket: PREVIEW_BUCKET, updated: 0 });
	}

	const paths = expiredRows.map((row) => row.preview_storage_path);
	const { error: removeError } = await admin.storage.from(PREVIEW_BUCKET).remove(paths);

	if (removeError) {
		return jsonResponse(
			{ deleted: 0, error: `Failed to remove expired previews: ${removeError.message}` },
			500,
		);
	}

	const expiredIds = expiredRows.map((row) => row.id);
	const { error: updateError } = await admin
		.from("trade_proposal_items")
		.update({
			preview_expires_at: null,
			preview_storage_path: null,
		})
		.in("id", expiredIds);

	if (updateError) {
		return jsonResponse(
			{
				deleted: paths.length,
				error: `Storage cleanup succeeded but DB cleanup failed: ${updateError.message}`,
			},
			500,
		);
	}

	return jsonResponse({
		bucket: PREVIEW_BUCKET,
		deleted: paths.length,
		updated: expiredIds.length,
	});
});
