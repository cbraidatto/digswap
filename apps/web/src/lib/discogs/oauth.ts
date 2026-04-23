import { DiscogsOAuth } from "@lionralfs/discogs-client";
import { env } from "@/lib/env";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Creates a DiscogsOAuth instance with the app's consumer credentials.
 * Centralizes credential access to avoid duplication.
 */
function createOAuthClient(): DiscogsOAuth {
	return new DiscogsOAuth(env.DISCOGS_CONSUMER_KEY, env.DISCOGS_CONSUMER_SECRET);
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
 * Contract (Phase 33.1 / DEP-AUD-05 hardening — Pitfall #11):
 * Tokens MUST be encrypted at rest in Supabase Vault. There is NO silent
 * fallback to the legacy `public.discogs_tokens` plaintext table. If Vault
 * is unavailable for any reason (extension missing, RPC wrapper missing,
 * permission denied, transient network failure), this function throws and
 * the caller is responsible for surfacing the error to the user.
 *
 * The legacy `public.discogs_tokens` table remains in the schema only as
 * an emergency migration target for the deleteTokens() cleanup path; it
 * MUST never be written to by storeTokens().
 *
 * History: previous versions had a try/catch that fell through to the
 * plaintext upsert when Vault returned an error object (rather than
 * throwing). This silently bypassed Vault on every OAuth flow because the
 * `public.vault_create_secret` PostgREST wrapper had never been deployed.
 * Migration 20260424000000_enable_vault_extension.sql adds the wrapper;
 * this function aborts if it ever fails again.
 *
 * @param userId - The Supabase user ID
 * @param accessToken - The Discogs OAuth access token
 * @param accessTokenSecret - The Discogs OAuth access token secret
 * @throws Error if Vault is unavailable — caller must propagate (do NOT
 *   log-and-continue).
 */
export async function storeTokens(
	userId: string,
	accessToken: string,
	accessTokenSecret: string,
): Promise<void> {
	const admin = createAdminClient();

	// Step 1: write the primary access token to Vault
	const { error: vaultTokenError } = await admin.rpc("vault_create_secret", {
		secret: accessToken,
		name: `discogs_token:${userId}`,
	});
	if (vaultTokenError) {
		console.error("[Discogs OAuth] Vault primary-token write failed", vaultTokenError);
		throw new Error(
			`Vault unavailable: cannot store Discogs token (${vaultTokenError.message ?? "unknown"})`,
		);
	}

	// Step 2: write the secondary token-secret to Vault
	const { error: vaultSecretError } = await admin.rpc("vault_create_secret", {
		secret: accessTokenSecret,
		name: `discogs_secret:${userId}`,
	});
	if (vaultSecretError) {
		// Best-effort cleanup of the first write so we don't leave a half-written
		// pair behind (orphan secret without its pair confuses lookup later).
		await admin.rpc("vault_delete_secret", {
			name: `discogs_token:${userId}`,
		});
		console.error("[Discogs OAuth] Vault secondary-secret write failed", vaultSecretError);
		throw new Error(
			`Vault unavailable: cannot store Discogs token-secret (${vaultSecretError.message ?? "unknown"})`,
		);
	}

	console.info(`[Discogs OAuth] Tokens stored in Vault for user ${userId}`);
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
