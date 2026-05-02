import * as Sentry from "@sentry/nextjs";

/**
 * Server-side Sentry init with PII filter.
 * Phase 39 deliverable: prod observability with sanitized error stream.
 *
 * Mirrors the client-side filter in instrumentation-client.ts. Server errors
 * may include DB error messages with email/token values in WHERE clauses, so
 * the same redaction patterns apply.
 */
function stripPii(value: unknown): unknown {
	if (typeof value !== "string") return value;
	let out = value;
	out = out.replace(/\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi, "[email-redacted]");
	out = out.replace(/eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}/g, "[jwt-redacted]");
	out = out.replace(/(authorization:\s*bearer\s+)[A-Za-z0-9._-]+/gi, "$1[bearer-redacted]");
	out = out.replace(/\bsk_(live|test)_[A-Za-z0-9]+\b/g, "[stripe-key-redacted]");
	out = out.replace(/\b[a-f0-9]{40}\b/gi, "[oauth-token-redacted]");
	return out;
}

const sharedConfig = {
	dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
	tracesSampleRate: 0.1,
	enabled: process.env.NODE_ENV === "production",

	beforeSend(event: Sentry.ErrorEvent): Sentry.ErrorEvent | null {
		const message =
			(typeof event.message === "string" ? event.message : "") ||
			event.exception?.values?.[0]?.value ||
			"";

		// Drop noisy errors that aren't actionable
		if (message.includes("ResizeObserver loop")) return null;

		// Strip PII
		if (event.message) {
			event.message = stripPii(event.message) as string;
		}
		if (event.exception?.values) {
			for (const exc of event.exception.values) {
				if (exc.value) exc.value = stripPii(exc.value) as string;
			}
		}
		if (event.breadcrumbs) {
			for (const crumb of event.breadcrumbs) {
				if (crumb.message) crumb.message = stripPii(crumb.message) as string;
			}
		}
		if (event.request?.url) {
			event.request.url = stripPii(event.request.url) as string;
		}

		return event;
	},
};

export async function register() {
	if (process.env.NEXT_RUNTIME === "nodejs") {
		Sentry.init(sharedConfig);
	}

	if (process.env.NEXT_RUNTIME === "edge") {
		Sentry.init(sharedConfig);
	}
}

export const onRequestError = Sentry.captureRequestError;
