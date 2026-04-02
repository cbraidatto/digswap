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
	HANDOFF_HMAC_SECRET: z.string().optional().default(""),
	RESEND_API_KEY: z.string().optional().default(""),
	RESEND_FROM_EMAIL: z.string().optional().default("noreply@digswap.com"),
	STRIPE_WEBHOOK_SECRET: z.string().optional().default(""),
	YOUTUBE_API_KEY: z.string().optional().default(""),
	SYSTEM_USER_ID: z.string().optional().default(""),
	UPSTASH_REDIS_REST_URL: z.string().optional().default(""),
	UPSTASH_REDIS_REST_TOKEN: z.string().optional().default(""),
	NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
});

const publicSchema = z.object({
	NEXT_PUBLIC_SUPABASE_URL: z.string().min(1, "NEXT_PUBLIC_SUPABASE_URL is required"),
	NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: z.string().min(1, "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY is required"),
	NEXT_PUBLIC_SITE_URL: z.string().optional().default("http://localhost:3000"),
	NEXT_PUBLIC_APP_URL: z.string().optional().default("http://localhost:3000"),
	NEXT_PUBLIC_STRIPE_PRICE_MONTHLY: z.string().optional().default(""),
	NEXT_PUBLIC_STRIPE_PRICE_ANNUAL: z.string().optional().default(""),
	NEXT_PUBLIC_MIN_DESKTOP_VERSION: z.string().optional().default("1"),
});

function validateEnv() {
	// Server env — only validate on server side
	if (typeof window === "undefined") {
		const result = serverSchema.safeParse(process.env);
		if (!result.success) {
			const missing = result.error.issues.map((i) => `  ${i.path.join(".")}: ${i.message}`).join("\n");
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
	});
	if (!result.success) {
		const missing = result.error.issues.map((i) => `  ${i.path.join(".")}: ${i.message}`).join("\n");
		throw new Error(`❌ Missing public environment variables:\n${missing}`);
	}
	return result.data;
}

export const env = validateEnv();
export const publicEnv = validatePublicEnv();
