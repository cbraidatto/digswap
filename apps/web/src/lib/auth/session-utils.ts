/**
 * Extracts the Supabase session_id claim from a JWT access token.
 *
 * The JWT payload is base64url-encoded in the second segment.
 * Used by both middleware (session allowlist) and auth actions (session tracking)
 * — kept in one place so the two sides always agree on the extraction logic.
 */
export function extractSessionId(accessToken: string): string | null {
	try {
		const payload = accessToken.split(".")[1];
		if (!payload) return null;
		const decoded = JSON.parse(Buffer.from(payload, "base64url").toString());
		return decoded.session_id ?? null;
	} catch {
		return null;
	}
}
