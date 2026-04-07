import { type NextRequest, NextResponse } from "next/server";
import { consumeHandoffCode } from "@/lib/desktop/handoff-store";
import { authRateLimit, safeLimit } from "@/lib/rate-limit";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * POST /api/desktop/session/exchange
 *
 * Called by the desktop app (server-side, not browser) to exchange a
 * single-use handoff code for a confirmed user identity.
 *
 * SECURITY: Rate limited per IP. Does NOT return email (information disclosure fix).
 */
export async function POST(request: NextRequest) {
	// Rate limit by IP — prevents brute-force of handoff codes
	const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
	const { success: rlOk } = await safeLimit(authRateLimit, `exchange:${ip}`, true);
	if (!rlOk) {
		return NextResponse.json({ error: "Too many requests" }, { status: 429 });
	}

	let body: { code?: string };
	try {
		body = await request.json();
	} catch {
		return NextResponse.json({ error: "Invalid body" }, { status: 400 });
	}

	const code = body.code?.trim();
	if (!code) {
		return NextResponse.json({ error: "code is required" }, { status: 400 });
	}

	// Look up and consume the handoff code (single-use, atomic via Redis Lua script)
	const userId = await consumeHandoffCode(code);

	if (!userId) {
		return NextResponse.json({ error: "Invalid or expired handoff code" }, { status: 401 });
	}

	try {
		const admin = createAdminClient();
		const { data: userData, error } = await admin.auth.admin.getUserById(userId);

		if (error || !userData.user) {
			return NextResponse.json({ error: "User not found" }, { status: 404 });
		}

		// SECURITY: Only return userId — email removed to prevent information disclosure.
		// Desktop app uses userId to initiate its own PKCE auth flow.
		return NextResponse.json({
			userId: userId,
			message: "Use PKCE flow with this confirmed user identity",
		});
	} catch (err) {
		console.error("[desktop/session/exchange] error:", err);
		return NextResponse.json({ error: "Exchange failed" }, { status: 500 });
	}
}
