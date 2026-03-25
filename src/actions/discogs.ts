"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getRequestToken } from "@/lib/discogs/oauth";

/**
 * Initiate Discogs OAuth 1.0a connection flow.
 *
 * Flow:
 * 1. Verify user is authenticated
 * 2. Request a temporary token from Discogs
 * 3. Store the request token in an httpOnly cookie (10 min TTL)
 * 4. Redirect user to Discogs authorization page
 *
 * The redirect() call from next/navigation throws internally --
 * it must be called outside try/catch or rethrown. This follows
 * the same pattern as existing server actions in src/actions/auth.ts.
 */
export async function connectDiscogs(): Promise<never> {
	const supabase = await createClient();
	const {
		data: { user },
	} = await supabase.auth.getUser();

	if (!user) {
		throw new Error("Not authenticated");
	}

	const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";
	const callbackUrl = `${siteUrl}/api/discogs/callback`;

	const { token, tokenSecret, authorizeUrl } =
		await getRequestToken(callbackUrl);

	// Store request token in httpOnly cookie for the callback.
	// sameSite: "lax" allows the cookie to survive the redirect back from Discogs.
	// maxAge: 600 (10 minutes) prevents stale tokens from lingering.
	const cookieStore = await cookies();
	cookieStore.set(
		"discogs_oauth",
		JSON.stringify({ token, tokenSecret }),
		{
			httpOnly: true,
			secure: process.env.NODE_ENV === "production",
			sameSite: "lax",
			maxAge: 600,
			path: "/",
		},
	);

	redirect(authorizeUrl);
}
