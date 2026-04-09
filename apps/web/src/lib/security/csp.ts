/**
 * Generates a nonce-based Content-Security-Policy header value.
 * Called per-request in middleware to eliminate unsafe-inline/unsafe-eval.
 *
 * @param nonce - Base64-encoded random UUID generated per request
 * @param isDev - Whether running in development mode (allows unsafe-eval for HMR)
 */
export function generateCspHeader(nonce: string, isDev: boolean): string {
	// Restrict to the exact project hostname to prevent XSS data exfiltration
	// to attacker-controlled Supabase projects via the wildcard.
	const supabaseHost = process.env.NEXT_PUBLIC_SUPABASE_URL
		? new URL(process.env.NEXT_PUBLIC_SUPABASE_URL).hostname
		: "*.supabase.co";

	const directives = [
		"default-src 'self'",
		`script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${isDev ? " 'unsafe-eval'" : ""}`,
		`style-src 'self' 'nonce-${nonce}' https://fonts.googleapis.com`,
		"img-src 'self' data: https://i.discogs.com https://st.discogs.com https://*.supabase.co https://i.ytimg.com",
		"font-src 'self' https://fonts.gstatic.com https://fonts.googleapis.com",
		`connect-src 'self' https://${supabaseHost} wss://${supabaseHost}`,
		"media-src 'self'",
		"worker-src 'self'",
		"frame-src 'self' https://www.youtube-nocookie.com https://www.youtube.com",
		"object-src 'none'",
		"base-uri 'self'",
		"frame-ancestors 'none'",
		"form-action 'self'",
	];
	return directives.join("; ");
}
