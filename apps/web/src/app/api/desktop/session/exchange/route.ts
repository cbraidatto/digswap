import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { handoffStore } from "@/lib/desktop/handoff-store";

/**
 * POST /api/desktop/session/exchange
 *
 * Called by the desktop app (server-side, not browser) to exchange a
 * single-use handoff code for a new session.
 *
 * The desktop app receives the handoff code via the desktopShell bridge,
 * then calls this endpoint to get its own independent session.
 */
export async function POST(request: NextRequest) {
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

	// Look up and consume the handoff code (single-use)
	const entry = handoffStore.get(code);
	handoffStore.delete(code); // Always delete — prevents replay

	if (!entry) {
		return NextResponse.json({ error: "Invalid or expired handoff code" }, { status: 401 });
	}

	if (entry.expiresAt < Date.now()) {
		return NextResponse.json({ error: "Handoff code expired" }, { status: 401 });
	}

	// Generate a new session for the desktop app via admin API
	// This creates an independent session that doesn't share the browser's tokens
	try {
		const admin = createAdminClient();

		// Use admin.auth.admin.generateLink to create a magic link,
		// or use the user ID to create a session via admin API
		// For now, we'll use the admin client to get user data and let the
		// desktop app use its own OAuth/PKCE flow with the confirmed user ID
		const { data: userData, error } = await admin.auth.admin.getUserById(entry.userId);

		if (error || !userData.user) {
			return NextResponse.json({ error: "User not found" }, { status: 404 });
		}

		return NextResponse.json({
			userId: entry.userId,
			email: userData.user.email,
			// Desktop app should use this to initiate its own PKCE auth flow
			// instead of receiving raw tokens
			message: "Use PKCE flow with this confirmed user identity",
		});
	} catch (err) {
		console.error("[desktop/session/exchange] error:", err);
		return NextResponse.json({ error: "Exchange failed" }, { status: 500 });
	}
}
