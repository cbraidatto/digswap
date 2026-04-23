import { createClient as createSbClient } from "@supabase/supabase-js";
import { type NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

/**
 * GET /api/user/me
 *
 * Authenticates by EITHER:
 *   - Supabase session cookie (default browser flow), OR
 *   - Authorization: Bearer <access_token> (machine flow + audit harness)
 *
 * Returns 401 when neither path resolves to a valid user.
 *
 * The Bearer path is REQUIRED by the DEP-AUD-04 Pitfall #10 audit
 * (apps/web/tests/e2e/audit/session-revocation.audit.spec.ts) — without
 * it, a stolen-JWT-after-logout attack cannot be tested because the cookie
 * gets cleared on logout in the same browser context.
 */
export async function GET(request: NextRequest) {
	// 1. Try cookie-based session first (the normal browser flow)
	const cookieClient = await createClient();
	const {
		data: { user: cookieUser },
	} = await cookieClient.auth.getUser();
	if (cookieUser) {
		return NextResponse.json({ id: cookieUser.id, email: cookieUser.email });
	}

	// 2. Fall back to Authorization: Bearer <access_token>
	const authHeader = request.headers.get("authorization") ?? request.headers.get("Authorization");
	if (authHeader?.toLowerCase().startsWith("bearer ")) {
		const token = authHeader.slice(7).trim();
		if (token) {
			// Use a stateless client (no cookies) and validate the token via getUser(token).
			// This calls Supabase's /auth/v1/user with the JWT, which honors revocation
			// (server-side checks the session table — exactly what Pitfall #10 verifies).
			const stateless = createSbClient(
				process.env.NEXT_PUBLIC_SUPABASE_URL!,
				process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY! ||
					process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
				{ auth: { persistSession: false, autoRefreshToken: false } },
			);
			const {
				data: { user: bearerUser },
				error,
			} = await stateless.auth.getUser(token);
			if (bearerUser && !error) {
				return NextResponse.json({ id: bearerUser.id, email: bearerUser.email });
			}
		}
	}

	return NextResponse.json({ error: "unauthorized" }, { status: 401 });
}
