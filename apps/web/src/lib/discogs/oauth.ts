import { DiscogsOAuth } from "@lionralfs/discogs-client";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Creates a DiscogsOAuth instance with the app's consumer credentials.
 * Centralizes credential access to avoid duplication.
 */
function createOAuthClient(): DiscogsOAuth {
	return new DiscogsOAuth(process.env.DISCOGS_CONSUMER_KEY!, process.env.DISCOGS_CONSUMER_SECRET!);
}

/**
 * Get an OAuth 1.0a request token from Discogs.
 *
 * Step 1 of the OAuth flow: request temporary credentials from Discogs,
 * then redirect the user to the authorize URL.
 *
 * @param callbackUrl - The URL Discogs will redirect to after user authorizes
 * @returns Request token, token secret, and Discogs authorize URL
 */
export async function getRequestToken(callbackUrl: string): Promise<{
	token: string;
	tokenSecret: string;
	authorizeUrl: string;
}> {
	const oauth = createOAuthClient();
	const result = await oauth.getRequestToken(callbackUrl);

	if (!result.token || !result.tokenSecret) {
		throw new Error("Failed to obtain request token from Discogs");
	}

	return {
		token: result.token,
		tokenSecret: result.tokenSecret,
		authorizeUrl: result.authorizeUrl,
	};
}

/**
 * Exchange an OAuth verifier for an access token.
 *
 * Step 3 of the OAuth flow: after the user authorizes on Discogs,
 * exchange the verifier code for permanent access credentials.
 *
 * @param token - The request token from step 1
 * @param tokenSecret - The request token secret from step 1
 * @param verifier - The OAuth verifier code from the callback
 * @returns Permanent access token and secret
 */
export async function getAccessToken(
	token: string,
	tokenSecret: string,
	verifier: string,
): Promise<{
	accessToken: string;
	accessTokenSecret: string;
}> {
	const oauth = createOAuthClient();
	const result = await oauth.getAccessToken(token, tokenSecret, verifier);

	if (!result.accessToken || !result.accessTokenSecret) {
		throw new Error("Failed to obtain access token from Discogs");
	}

	return {
		accessToken: result.accessToken,
		accessTokenSecret: result.accessTokenSecret,
	};
}

/**
 * Store Discogs OAuth tokens securely for a user.
 *
 * Strategy: Try Supabase Vault first (encrypted at rest), fall back to
 * a `discogs_tokens` table if Vault is not available (e.g., local dev
 * without Vault extension enabled).
 *
 * @param userId - The Supabase user ID
 * @param accessToken - The Discogs OAuth access token
 * @param accessTokenSecret - The Discogs OAuth access token secret
 */
export async function storeTokens(
	userId: string,
	accessToken: string,
	accessTokenSecret: string,
): Promise<void> {
	const admin = createAdminClient();

	// Attempt Vault storage first (encrypted at rest)
	const { error: vaultTokenError } = await admin.rpc("vault_create_secret", {
		secret: accessToken,
		name: `discogs_token:${userId}`,
	});

	if (!vaultTokenError) {
		const { error: vaultSecretError } = await admin.rpc("vault_create_secret", {
			secret: accessTokenSecret,
			name: `discogs_secret:${userId}`,
		});

		if (!vaultSecretError) {
			console.info(`[Discogs OAuth] Tokens stored in Vault for user ${userId}`);
			return;
		}

		// Second secret failed -- clean up the first and fall through
		await admin.rpc("vault_delete_secret", {
			name: `discogs_token:${userId}`,
		});
	}

	// Fallback: store in discogs_tokens table
	const { error: tableError } = await admin.from("discogs_tokens").upsert(
		{
			user_id: userId,
			access_token: accessToken,
			access_token_secret: accessTokenSecret,
			updated_at: new Date().toISOString(),
		},
		{ onConflict: "user_id" },
	);

	if (tableError) {
		throw new Error(`Failed to store Discogs tokens: ${tableError.message}`);
	}

	console.info(`[Discogs OAuth] Tokens stored in fallback table for user ${userId}`);
}

/**
 * Delete Discogs OAuth tokens for a user.
 *
 * Cleans up both Vault secrets and fallback table entries to ensure
 * complete removal regardless of which storage method was used.
 *
 * Used by the disconnect flow (Plan 05).
 *
 * @param userId - The Supabase user ID
 */
export async function deleteTokens(userId: string): Promise<void> {
	const admin = createAdminClient();

	// Delete from Vault (ignore errors -- may not exist)
	await admin.rpc("vault_delete_secret", {
		name: `discogs_token:${userId}`,
	});
	await admin.rpc("vault_delete_secret", {
		name: `discogs_secret:${userId}`,
	});

	// Delete from fallback table (ignore errors -- may not exist)
	await admin.from("discogs_tokens").delete().eq("user_id", userId);
}
