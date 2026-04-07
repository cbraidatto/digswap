import { randomBytes } from "node:crypto";
import { NextResponse } from "next/server";
import { storeHandoffCode } from "@/lib/desktop/handoff-store";
import { apiRateLimit, safeLimit } from "@/lib/rate-limit";
import { createClient } from "@/lib/supabase/server";

/**
 * POST /api/desktop/session
 *
 * Generates a single-use handoff code that the desktop app can exchange
 * for a session via /api/desktop/session/exchange.
 *
 * The handoff code:
 * - Is 32 bytes of cryptographic randomness (URL-safe base64)
 * - Expires after 30 seconds
 * - Can only be used once
 * - Never contains actual session tokens
 *
 * This replaces the previous GET endpoint that returned raw tokens to the browser.
 */
export async function POST() {
	const supabase = await createClient();
	const {
		data: { user },
	} = await supabase.auth.getUser();

	if (!user) {
		return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
	}

	const { success } = await safeLimit(apiRateLimit, user.id, false);
	if (!success) {
		return NextResponse.json({ error: "Too many requests" }, { status: 429 });
	}

	// Generate single-use handoff code
	const code = randomBytes(32).toString("base64url");

	try {
		await storeHandoffCode(code, user.id);
	} catch (err) {
		console.error("[desktop/session] failed to store handoff code:", err);
		return NextResponse.json({ error: "Service unavailable" }, { status: 503 });
	}

	return NextResponse.json({ code, expiresIn: 30 });
}

/**
 * Exchange a handoff code for session tokens.
 * This should ONLY be called server-side by the desktop app, never from the browser.
 *
 * @deprecated GET method removed — was returning raw tokens to browser JS.
 */
export async function GET() {
	return NextResponse.json(
		{
			error: "This endpoint no longer returns session tokens. Use POST to generate a handoff code.",
		},
		{ status: 410 },
	);
}
