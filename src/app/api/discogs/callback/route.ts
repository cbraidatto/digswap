import { cookies } from "next/headers";
import { type NextRequest, NextResponse } from "next/server";
import { DiscogsClient } from "@lionralfs/discogs-client";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getAccessToken, storeTokens } from "@/lib/discogs/oauth";

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
 */
export async function GET(request: NextRequest) {
	const { searchParams } = new URL(request.url);
	const oauthToken = searchParams.get("oauth_token");
	const oauthVerifier = searchParams.get("oauth_verifier");
	const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";

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
				consumerKey: process.env.DISCOGS_CONSUMER_KEY!,
				consumerSecret: process.env.DISCOGS_CONSUMER_SECRET!,
				accessToken,
				accessTokenSecret,
			},
			userAgent: "VinylDig/1.0",
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
					Authorization: `Bearer ${process.env.IMPORT_WORKER_SECRET}`,
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
		return NextResponse.redirect(
			`${siteUrl}/settings?error=${encodeURIComponent("Could not connect to Discogs. Please try again.")}`,
		);
	}
}
