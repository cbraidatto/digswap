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
		// 'unsafe-inline' required: Sonner injects inline style= attributes
		// which cannot use nonces (nonces only work on <style> tags, not style attributes)
		`style-src 'self' 'unsafe-inline' https://fonts.googleapis.com`,
		"img-src 'self' data: https:",
		"font-src 'self' https://fonts.gstatic.com https://fonts.googleapis.com",
		"connect-src 'self' https://*.supabase.co wss://*.supabase.co",
		"media-src 'self'",
		"worker-src 'self'",
		"frame-src 'self' https://www.youtube-nocookie.com",
		"frame-ancestors 'none'",
		"form-action 'self'",
	];
	return directives.join("; ");
}
