import { and, eq, isNotNull, or } from "drizzle-orm";
import { type NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { collectionItems } from "@/lib/db/schema/collections";
import { tradeProposalItems, tradeProposals, tradeRequests } from "@/lib/db/schema/trades";
import { env, publicEnv } from "@/lib/env";
import { createClient } from "@/lib/supabase/server";
import { createClient as createServiceClient } from "@supabase/supabase-js";

/**
 * GET /api/trade-preview/audio?itemId=<proposalItemId>
 *
 * Proxies a trade preview audio file from Supabase Storage through the
 * Next.js server. This avoids Electron's URL safety check which blocks
 * direct media loads from external origins (supabase.co).
 *
 * Authorization: caller must be a participant in the trade that owns this item.
 */
export async function GET(request: NextRequest) {
	const { searchParams } = new URL(request.url);
	const itemId = searchParams.get("itemId");

	if (!itemId) {
		return new NextResponse("Missing itemId", { status: 400 });
	}

	// Authenticate user
	const supabase = await createClient();
	const { data: { user } } = await supabase.auth.getUser();
	if (!user) {
		return new NextResponse("Unauthorized", { status: 401 });
	}

	// Verify the user is a participant in the trade that owns this item
	const [item] = await db
		.select({
			previewStoragePath: tradeProposalItems.previewStoragePath,
			tradeId: tradeProposals.tradeId,
		})
		.from(tradeProposalItems)
		.innerJoin(tradeProposals, eq(tradeProposalItems.proposalId, tradeProposals.id))
		.innerJoin(tradeRequests, eq(tradeProposals.tradeId, tradeRequests.id))
		.where(
			and(
				eq(tradeProposalItems.id, itemId),
				isNotNull(tradeProposalItems.previewStoragePath),
			),
		)
		.limit(1);

	if (!item?.previewStoragePath) {
		return new NextResponse("Not found", { status: 404 });
	}

	// Verify current user is a participant in this trade
	const [trade] = await db
		.select({ id: tradeRequests.id })
		.from(tradeRequests)
		.where(
			and(
				eq(tradeRequests.id, item.tradeId),
				or(eq(tradeRequests.requesterId, user.id), eq(tradeRequests.providerId, user.id)),
			),
		)
		.limit(1);

	if (!trade) {
		return new NextResponse("Forbidden", { status: 403 });
	}

	const serviceSupabase = createServiceClient(
		publicEnv.NEXT_PUBLIC_SUPABASE_URL,
		env.SUPABASE_SERVICE_ROLE_KEY,
	);

	// Generate a fresh signed URL (1 minute — just for this stream)
	const { data: signed, error: signedError } = await serviceSupabase.storage
		.from("trade-previews")
		.createSignedUrl(item.previewStoragePath, 60);

	if (signedError || !signed?.signedUrl) {
		return new NextResponse("Failed to generate signed URL", { status: 500 });
	}

	// Fetch the file from Supabase Storage
	const upstream = await fetch(signed.signedUrl);
	if (!upstream.ok) {
		return new NextResponse("Failed to fetch audio", { status: upstream.status });
	}

	// Stream back with proper headers for audio playback
	const contentType = upstream.headers.get("content-type") ?? "audio/wav";
	const contentLength = upstream.headers.get("content-length");

	const headers = new Headers({
		"Content-Type": contentType,
		"Accept-Ranges": "bytes",
		"Cache-Control": "private, no-store",
	});
	if (contentLength) headers.set("Content-Length", contentLength);

	return new NextResponse(upstream.body, { status: 200, headers });
}
