import { type NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { apiRateLimit, safeLimit } from "@/lib/rate-limit";
import { createAdminClient } from "@/lib/supabase/admin";
import { processSyncBatch } from "@/lib/sync/process-sync-batch";

export const runtime = "nodejs";

const trackSchema = z.object({
	localTrackId: z.string(),
	filePath: z.string(),
	artist: z.string().nullable(),
	album: z.string().nullable(),
	title: z.string().nullable(),
	year: z.number().int().nullable(),
	trackNumber: z.number().int().nullable(),
	format: z.string(),
	bitrate: z.number().int(),
	sampleRate: z.number().int(),
	duration: z.number(),
	artistConfidence: z.enum(["high", "low"]),
	albumConfidence: z.enum(["high", "low"]),
});

const syncRequestSchema = z.object({
	tracks: z.array(trackSchema).max(100),
	deletedReleaseIds: z.array(z.string().uuid()).max(200).default([]),
});

export async function POST(request: NextRequest) {
	// Auth: Bearer token validation (same pattern as handoff/consume)
	const authHeader = request.headers.get("authorization");
	const accessToken = authHeader?.startsWith("Bearer ") ? authHeader.slice("Bearer ".length) : null;

	if (!accessToken) {
		return NextResponse.json({ error: "Missing bearer token" }, { status: 401 });
	}

	const admin = createAdminClient();
	const {
		data: { user },
		error: userError,
	} = await admin.auth.getUser(accessToken);

	if (userError || !user) {
		return NextResponse.json({ error: "Invalid desktop session" }, { status: 401 });
	}

	// Rate limit: fail-open for sync (non-critical)
	const { success: rlSuccess } = await safeLimit(apiRateLimit, `sync:${user.id}`, false);
	if (!rlSuccess) {
		return NextResponse.json({ error: "Too many requests" }, { status: 429 });
	}

	// Parse and validate body
	let rawBody: unknown;
	try {
		rawBody = await request.json();
	} catch {
		return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
	}

	const parsed = syncRequestSchema.safeParse(rawBody);
	if (!parsed.success) {
		return NextResponse.json(
			{ error: "Validation failed", details: parsed.error.issues },
			{ status: 400 },
		);
	}

	const { tracks, deletedReleaseIds } = parsed.data;

	// Process the batch
	const result = await processSyncBatch(user.id, tracks, deletedReleaseIds);

	return NextResponse.json(result, { status: result.ok ? 200 : 207 });
}
