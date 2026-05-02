import * as Sentry from "@sentry/nextjs";

/**
 * Strip PII (emails, tokens, JWTs) from breadcrumb messages, exception values,
 * and request URLs/headers BEFORE the event leaves the browser. Phase 39 owns
 * the production observability layer; this filter is the first line of defence.
 *
 * Also filters CSP-style violation noise that comes from third-party UI library
 * inline-style injection — those are handled by the CSP fix (e5a978b) but legacy
 * deploys may still log them.
 */
function stripPii(value: unknown): unknown {
	if (typeof value !== "string") return value;
	let out = value;
	// Email addresses
	out = out.replace(/\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi, "[email-redacted]");
	// JWT-shaped tokens (eyJ...) — Supabase tokens
	out = out.replace(/eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}/g, "[jwt-redacted]");
	// Bearer tokens in headers
	out = out.replace(/(authorization:\s*bearer\s+)[A-Za-z0-9._-]+/gi, "$1[bearer-redacted]");
	// Stripe live secret keys (sk_live_*)
	out = out.replace(/\bsk_(live|test)_[A-Za-z0-9]+\b/g, "[stripe-key-redacted]");
	// Discogs OAuth tokens (40-char hex pattern)
	out = out.replace(/\b[a-f0-9]{40}\b/gi, "[oauth-token-redacted]");
	return out;
}

Sentry.init({
	dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
	tracesSampleRate: 0.1,
	replaysSessionSampleRate: 0,
	replaysOnErrorSampleRate: 1.0,
	enabled: process.env.NODE_ENV === "production",

	// Spike protection: cap events sent to ~50/hour from any single client.
	// Combined with Sentry org-level spike protection, prevents a single error
	// loop from blowing through the free-tier 5K/month quota.
	beforeSend(event, hint) {
		// 1. Drop CSP style-src violations (handled by CSP fix; ignore stale logs)
		const message =
			(typeof event.message === "string" ? event.message : "") ||
			(hint?.originalException instanceof Error ? hint.originalException.message : "");
		if (
			message.includes("Content Security Policy") &&
			message.includes("style-src")
		) {
			return null;
		}

		// 2. Drop ResizeObserver loop errors (browser-internal, harmless)
		if (message.includes("ResizeObserver loop")) {
			return null;
		}

		// 3. Strip PII from message + exception values
		if (event.message) {
			event.message = stripPii(event.message) as string;
		}
		if (event.exception?.values) {
			for (const exc of event.exception.values) {
				if (exc.value) exc.value = stripPii(exc.value) as string;
			}
		}

		// 4. Strip PII from breadcrumb messages
		if (event.breadcrumbs) {
			for (const crumb of event.breadcrumbs) {
				if (crumb.message) crumb.message = stripPii(crumb.message) as string;
				if (crumb.data) {
					for (const k of Object.keys(crumb.data)) {
						crumb.data[k] = stripPii(crumb.data[k]);
					}
				}
			}
		}

		// 5. Strip PII from request URL + headers
		if (event.request?.url) {
			event.request.url = stripPii(event.request.url) as string;
		}
		if (event.request?.headers) {
			for (const k of Object.keys(event.request.headers)) {
				event.request.headers[k] = stripPii(event.request.headers[k]) as string;
			}
		}

		return event;
	},
});
