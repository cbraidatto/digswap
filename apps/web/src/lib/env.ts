import { z } from "zod";

/**
 * Centralized environment variable validation.
 * Import `env` or `publicEnv` instead of accessing process.env directly.
 * If a required var is missing, the app fails at import time with a clear message.
 */

const serverSchema = z.object({
	DATABASE_URL: z.string().min(1, "DATABASE_URL is required"),
	SUPABASE_SERVICE_ROLE_KEY: z.string().min(1, "SUPABASE_SERVICE_ROLE_KEY is required"),
	DISCOGS_CONSUMER_KEY: z.string().min(1, "DISCOGS_CONSUMER_KEY is required"),
	DISCOGS_CONSUMER_SECRET: z.string().min(1, "DISCOGS_CONSUMER_SECRET is required"),
	IMPORT_WORKER_SECRET: z.string().min(1, "IMPORT_WORKER_SECRET is required"),
	// SECURITY: Always require HANDOFF_HMAC_SECRET when deployed (Vercel sets VERCEL=1).
	// The dev default is only used in local development without VERCEL env var.
	HANDOFF_HMAC_SECRET:
		process.env.NODE_ENV === "production" || process.env.VERCEL
			? z.string().min(32, "HANDOFF_HMAC_SECRET must be at least 32 chars in production/Vercel")
			: z.string().optional().default("dev-hmac-secret-not-for-production"),
	RESEND_API_KEY: z.string().optional().default(""),
	RESEND_FROM_EMAIL: z.string().optional().default("noreply@digswap.com"),
	STRIPE_SECRET_KEY:
		process.env.NODE_ENV === "production"
			? z.string().min(10, "STRIPE_SECRET_KEY is required in production")
			: z.string().optional().default(""),
	STRIPE_WEBHOOK_SECRET:
		process.env.NODE_ENV === "production"
			? z.string().min(10, "STRIPE_WEBHOOK_SECRET is required in production")
			: z.string().optional().default(""),
	YOUTUBE_API_KEY: z.string().optional().default(""),
	SYSTEM_USER_ID: z.string().optional().default(""),
	UPSTASH_REDIS_REST_URL: z.string().optional().default(""),
	UPSTASH_REDIS_REST_TOKEN: z.string().optional().default(""),
	NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
});

const publicSchema = z.object({
	NEXT_PUBLIC_SUPABASE_URL: z.string().min(1, "NEXT_PUBLIC_SUPABASE_URL is required"),
	NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: z
		.string()
		.min(1, "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY is required"),
	NEXT_PUBLIC_SITE_URL:
		process.env.NODE_ENV === "production" || process.env.VERCEL
			? z.string().min(1, "NEXT_PUBLIC_SITE_URL is required in production/Vercel")
			: z.string().optional().default("http://localhost:3000"),
	NEXT_PUBLIC_APP_URL:
		process.env.NODE_ENV === "production" || process.env.VERCEL
			? z.string().min(1, "NEXT_PUBLIC_APP_URL is required in production/Vercel")
			: z.string().optional().default("http://localhost:3000"),
	NEXT_PUBLIC_STRIPE_PRICE_MONTHLY: z.string().optional().default(""),
	NEXT_PUBLIC_STRIPE_PRICE_ANNUAL: z.string().optional().default(""),
	NEXT_PUBLIC_SENTRY_DSN: z.string().optional().default(""),
	NEXT_PUBLIC_MIN_DESKTOP_VERSION: z.string().optional().default("0.2.0"),
	NEXT_PUBLIC_BILLING_ENABLED: z.string().optional().default("false"),
});

function validateEnv() {
	// Server env — validate on server side and in test environments (jsdom has window)
	if (typeof window === "undefined" || process.env.VITEST) {
		const result = serverSchema.safeParse(process.env);
		if (!result.success) {
			const missing = result.error.issues
				.map((i) => `  ${i.path.join(".")}: ${i.message}`)
				.join("\n");
			throw new Error(`❌ Missing server environment variables:\n${missing}`);
		}
		return result.data;
	}
	return {} as z.infer<typeof serverSchema>;
}

function validatePublicEnv() {
	const result = publicSchema.safeParse({
		NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
		NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
		NEXT_PUBLIC_SITE_URL: process.env.NEXT_PUBLIC_SITE_URL,
		NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL,
		NEXT_PUBLIC_STRIPE_PRICE_MONTHLY: process.env.NEXT_PUBLIC_STRIPE_PRICE_MONTHLY,
		NEXT_PUBLIC_STRIPE_PRICE_ANNUAL: process.env.NEXT_PUBLIC_STRIPE_PRICE_ANNUAL,
		NEXT_PUBLIC_MIN_DESKTOP_VERSION: process.env.NEXT_PUBLIC_MIN_DESKTOP_VERSION,
		NEXT_PUBLIC_BILLING_ENABLED: process.env.NEXT_PUBLIC_BILLING_ENABLED,
	});
	if (!result.success) {
		const missing = result.error.issues
			.map((i) => `  ${i.path.join(".")}: ${i.message}`)
			.join("\n");
		throw new Error(`❌ Missing public environment variables:\n${missing}`);
	}
	return result.data;
}

export const env = validateEnv();
export const publicEnv = validatePublicEnv();
