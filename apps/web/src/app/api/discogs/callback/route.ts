import { DiscogsClient } from "@lionralfs/discogs-client";
import { cookies } from "next/headers";
import { type NextRequest, NextResponse } from "next/server";
import { getAccessToken, storeTokens } from "@/lib/discogs/oauth";
import { env, publicEnv } from "@/lib/env";
import { authRateLimit, safeLimit } from "@/lib/rate-limit";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

/**
 * Discogs OAuth 1.0a callback handler.
 *
 * Flow (per D-03: OAuth success triggers import immediately):
 * 1. Extract oauth_token and oauth_verifier from query params
 * 2. Retrieve request token from httpOnly cookie
 * 3. Exchange verifier for access token
 * 4. Get Discogs identity (username)
 * 5. Store tokens securely (Vault with table fallback)
 * 6. Update user profile (discogs_connected, discogs_username)
 * 7. Check for existing active import job (prevent duplicates)
 * 8. Create import job (collection first per D-07)
 * 9. Fire-and-forget import worker invocation
 * 10. Redirect to /import-progress
 *
 * SECURITY: Rate limited per IP to prevent abuse of Discogs API quota.
 */
export async function GET(request: NextRequest) {
	const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
	const { success: rlOk } = await safeLimit(authRateLimit, `discogs-cb:${ip}`, true);
	if (!rlOk) {
		const siteUrl = publicEnv.NEXT_PUBLIC_SITE_URL;
		return NextResponse.redirect(
			`${siteUrl}/settings?error=${encodeURIComponent("Too many requests. Please try again later.")}`,
		);
	}
	const { searchParams } = new URL(request.url);
	const oauthToken = searchParams.get("oauth_token");
	const oauthVerifier = searchParams.get("oauth_verifier");
	const siteUrl = publicEnv.NEXT_PUBLIC_SITE_URL;

	if (!oauthToken || !oauthVerifier) {
		// User denied authorization or error occurred
		return NextResponse.redirect(
			`${siteUrl}/settings?error=${encodeURIComponent("Discogs authorization failed. Please try connecting again from Settings.")}`,
		);
	}

	try {
		// 1. Retrieve request token from cookie
		const cookieStore = await cookies();
		const oauthCookie = cookieStore.get("discogs_oauth");

		if (!oauthCookie) {
			return NextResponse.redirect(
				`${siteUrl}/settings?error=${encodeURIComponent("OAuth session expired. Please try connecting again.")}`,
			);
		}

		const { token, tokenSecret } = JSON.parse(oauthCookie.value) as {
			token: string;
			tokenSecret: string;
		};

		// SECURITY: Validate the oauth_token from the callback matches the one we stored.
		// This prevents CSRF attacks where an attacker substitutes their own request token
		// in the callback URL. In OAuth 1.0a, the provider returns the same request token
		// we sent — if it doesn't match our cookie, the flow was tampered with.
		if (oauthToken !== token) {
			console.error("[discogs-oauth] Token mismatch: callback token does not match cookie token");
			cookieStore.delete("discogs_oauth");
			return NextResponse.redirect(
				`${siteUrl}/settings?error=${encodeURIComponent("OAuth token mismatch. Please try connecting again.")}`,
			);
		}

		// Clear the OAuth cookie
		cookieStore.delete("discogs_oauth");

		// 2. Exchange verifier for access token
		const { accessToken, accessTokenSecret } = await getAccessToken(
			token,
			tokenSecret,
			oauthVerifier,
		);

		// 3. Get authenticated user
		const supabase = await createClient();
		const {
			data: { user },
		} = await supabase.auth.getUser();

		if (!user) {
			return NextResponse.redirect(`${siteUrl}/signin`);
		}

		// 4. Get Discogs identity (username)
		const discogsClient = new DiscogsClient({
			auth: {
				method: "oauth",
				consumerKey: env.DISCOGS_CONSUMER_KEY,
				consumerSecret: env.DISCOGS_CONSUMER_SECRET,
				accessToken,
				accessTokenSecret,
			},
			userAgent: "DigSwap/1.0",
		});

		const identity = await discogsClient.getIdentity();
		const discogsUsername = identity.data.username;

		// 5. Store tokens securely
		await storeTokens(user.id, accessToken, accessTokenSecret);

		// 6. Update profile (admin client bypasses RLS -- needed for service-level update)
		const admin = createAdminClient();
		await admin
			.from("profiles")
			.update({
				discogs_connected: true,
				discogs_username: discogsUsername,
				updated_at: new Date().toISOString(),
			})
			.eq("id", user.id);

		// 7. Check for existing active import job (prevent duplicates per Pitfall 1)
		const existingJobs = await admin
			.from("import_jobs")
			.select("id")
			.eq("user_id", user.id)
			.in("status", ["pending", "processing"])
			.limit(1);

		if (existingJobs.data && existingJobs.data.length > 0) {
			// Already importing, redirect to progress
			return NextResponse.redirect(`${siteUrl}/import-progress`);
		}

		// 8. Create import job (collection first per D-07)
		const { data: job } = await admin
			.from("import_jobs")
			.insert({
				user_id: user.id,
				type: "collection",
				status: "pending",
				total_items: 0,
				processed_items: 0,
				current_page: 1,
				created_at: new Date().toISOString(),
			})
			.select("id")
			.single();

		// 9. Trigger import worker (fire-and-forget self-invocation)
		if (job) {
			fetch(`${siteUrl}/api/discogs/import`, {
				method: "POST",
				headers: {
					"Content-Type": "application/json",
					Authorization: `Bearer ${env.IMPORT_WORKER_SECRET}`,
				},
				body: JSON.stringify({ jobId: job.id }),
			}).catch(() => {
				// Fire-and-forget: import worker will pick up the job via polling if this fails
			});
		}

		// 10. Redirect to import progress (per D-03)
		return NextResponse.redirect(`${siteUrl}/import-progress`);
	} catch (error) {
		console.error("Discogs OAuth callback error:", error);

		// Phase 33.1 / DEP-AUD-05 hardening (Pitfall #11):
		// storeTokens() now throws when Vault is unavailable. We MUST NOT
		// swallow that error by redirecting back to /settings with a generic
		// success-shaped page (HTTP 307 to a 200 route), because that masks
		// what is effectively a security-critical infrastructure failure
		// (we cannot encrypt the user's Discogs OAuth credentials at rest).
		//
		// Detect Vault failures by message marker and return an explicit
		// HTTP 500 so operators see it in error monitoring and the user gets
		// a clear "something is wrong on our side" signal rather than a
		// silently-broken Discogs connection.
		const message = error instanceof Error ? error.message : String(error);
		if (message.includes("Vault unavailable")) {
			return NextResponse.json(
				{
					ok: false,
					error: "discogs_vault_unavailable",
					message:
						"We could not securely store your Discogs credentials. Please contact support — this is an infrastructure issue on our side.",
				},
				{ status: 500 },
			);
		}

		// All other errors (Discogs API down, rate limit, network blip)
		// remain user-facing redirects with the existing UX.
		return NextResponse.redirect(
			`${siteUrl}/settings?error=${encodeURIComponent("Could not connect to Discogs. Please try again.")}`,
		);
	}
}
