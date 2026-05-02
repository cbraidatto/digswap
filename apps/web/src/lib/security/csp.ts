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
		// style-src: pragmatic 'unsafe-inline' (no nonce) — modern UI libs (@base-ui/react,
		// framer-motion, @dnd-kit, sonner) inject runtime inline styles via element.style.X = Y
		// which CANNOT be nonce-tagged. Per CSP3 spec, when nonce + 'unsafe-inline' coexist,
		// browsers IGNORE 'unsafe-inline' and runtime injected styles are blocked. Dropping the
		// nonce here is the canonical fix — CSS-injection XSS is far lower impact than script-src
		// XSS, and OWASP CSP cheat sheet explicitly accepts 'unsafe-inline' on style-src.
		// Script-src above keeps nonce + strict-dynamic — script XSS protection unchanged.
		"style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
		"img-src 'self' data: https://i.discogs.com https://st.discogs.com https://*.supabase.co https://i.ytimg.com",
		"font-src 'self' https://fonts.gstatic.com https://fonts.googleapis.com",
		// connect-src: app's own backend + Supabase + Vercel Analytics/Speed Insights beacons
		// (Phase 39 observability). The Analytics script also fetches its bundle from
		// va.vercel-scripts.com but that's allowed via 'strict-dynamic' on script-src.
		`connect-src 'self' https://${supabaseHost} wss://${supabaseHost} https://va.vercel-scripts.com https://vitals.vercel-insights.com`,
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
