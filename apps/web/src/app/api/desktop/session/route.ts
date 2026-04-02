import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { apiRateLimit } from "@/lib/rate-limit";

/**
 * GET /api/desktop/session
 *
 * Returns the current session tokens for the Electron desktop shell to sync
 * into its safeStorage vault via window.desktopShell.syncSession().
 *
 * Uses the server-side Supabase client which can read HttpOnly auth cookies —
 * the browser-side client cannot access those cookies directly.
 *
 * Returns null when no authenticated session exists.
 */
export async function GET() {
	const supabase = await createClient();
	const {
		data: { session },
	} = await supabase.auth.getSession();

	if (!session?.access_token || !session.refresh_token) {
		return NextResponse.json(null);
	}

	// SEC-04: rate limit by user ID (30 req/60s — same as general API)
	const { success } = await apiRateLimit.limit(session.user.id);
	if (!success) {
		return NextResponse.json({ error: "Too many requests" }, { status: 429 });
	}

	return NextResponse.json({
		accessToken: session.access_token,
		refreshToken: session.refresh_token,
	});
}
