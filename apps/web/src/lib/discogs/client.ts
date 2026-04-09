import { DiscogsClient } from "@lionralfs/discogs-client";
import { env } from "@/lib/env";
import { createAdminClient } from "@/lib/supabase/admin";

const CONSUMER_KEY = env.DISCOGS_CONSUMER_KEY;
const CONSUMER_SECRET = env.DISCOGS_CONSUMER_SECRET;

/**
 * Creates an authenticated Discogs API client for a given user.
 * Retrieves OAuth tokens from Supabase Vault (preferred) or fallback table.
 *
 * WARNING: Server-side only. Never import this in client components.
 */
export async function createDiscogsClient(userId: string): Promise<DiscogsClient> {
	const admin = createAdminClient();

	// Retrieve tokens from Vault (or fallback table)
	const { data: tokenRows } = await admin
		.from("vault.decrypted_secrets")
		.select("decrypted_secret")
		.eq("name", `discogs_token:${userId}`)
		.single();

	const { data: secretRows } = await admin
		.from("vault.decrypted_secrets")
		.select("decrypted_secret")
		.eq("name", `discogs_secret:${userId}`)
		.single();

	// If Vault is unavailable, fall back to discogs_tokens table
	let accessToken: string;
	let accessTokenSecret: string;

	if (tokenRows?.decrypted_secret && secretRows?.decrypted_secret) {
		accessToken = tokenRows.decrypted_secret;
		accessTokenSecret = secretRows.decrypted_secret;
	} else {
		// Fallback: service-role-only table
		const { data: fallback } = await admin
			.from("discogs_tokens")
			.select("access_token, access_token_secret")
			.eq("user_id", userId)
			.single();
		if (!fallback) throw new Error("No Discogs tokens found for user");
		accessToken = fallback.access_token;
		accessTokenSecret = fallback.access_token_secret;
	}

	const client = new DiscogsClient({
		auth: {
			method: "oauth",
			consumerKey: CONSUMER_KEY,
			consumerSecret: CONSUMER_SECRET,
			accessToken,
			accessTokenSecret,
		},
		userAgent: "DigSwap/1.0",
	});

	return client;
}

/**
 * Computes a rarity score from Discogs have/want counts.
 * Returns the raw want/have ratio (higher = rarer). No upper bound.
 * Returns null if both have and want are 0 (insufficient data).
 */
export function computeRarityScore(
	have: number | undefined,
	want: number | undefined,
): number | null {
	const h = have ?? 0;
	const w = want ?? 0;
	if (h === 0 && w === 0) return null;
	if (h === 0) return 1.0; // Nobody has it, high rarity
	return w / h;
}
