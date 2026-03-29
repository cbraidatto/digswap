/**
 * Generates a nonce-based Content-Security-Policy header value.
 * Called per-request in middleware to eliminate unsafe-inline/unsafe-eval.
 *
 * @param nonce - Base64-encoded random UUID generated per request
 * @param isDev - Whether running in development mode (allows unsafe-eval for HMR)
 */
export function generateCspHeader(nonce: string, isDev: boolean): string {
	const directives = [
		"default-src 'self'",
		`script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${isDev ? " 'unsafe-eval'" : ""}`,
		`style-src 'self' 'nonce-${nonce}' https://fonts.googleapis.com`,
		"img-src 'self' data: https:",
		"font-src 'self' https://fonts.gstatic.com https://fonts.googleapis.com",
		"connect-src 'self' https://*.supabase.co wss://*.supabase.co https://0.peerjs.com wss://0.peerjs.com",
		"frame-src 'self' https://www.youtube-nocookie.com",
		"frame-ancestors 'none'",
		"form-action 'self'",
	];
	return directives.join("; ");
}
