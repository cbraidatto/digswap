import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";

const redis = new Redis({
	url: process.env.UPSTASH_REDIS_REST_URL!,
	token: process.env.UPSTASH_REDIS_REST_TOKEN!,
});

/**
 * Auth endpoints rate limiter: 5 attempts per 60 seconds per IP.
 * Apply to login, signup endpoints to prevent brute force attacks.
 * Per D-16: Rate limiting on all auth endpoints.
 */
export const authRateLimit = new Ratelimit({
	redis,
	limiter: Ratelimit.slidingWindow(5, "60 s"),
	analytics: true,
	prefix: "ratelimit:auth",
});

/**
 * Password reset rate limiter: 3 attempts per 15 minutes per email.
 * Prevents abuse of the password reset flow.
 */
export const resetRateLimit = new Ratelimit({
	redis,
	limiter: Ratelimit.slidingWindow(3, "15 m"),
	analytics: true,
	prefix: "ratelimit:reset",
});

/**
 * TOTP verification rate limiter: 5 attempts per 5 minutes per user ID.
 * Prevents brute force of 2FA codes.
 */
export const totpRateLimit = new Ratelimit({
	redis,
	limiter: Ratelimit.slidingWindow(5, "5 m"),
	analytics: true,
	prefix: "ratelimit:totp",
});

/** General API actions: 30 req per 60s per user (social, community, profile, collection, etc.) */
export const apiRateLimit = new Ratelimit({
	redis,
	limiter: Ratelimit.slidingWindow(30, "60 s"),
	analytics: true,
	prefix: "ratelimit:api",
});

/** Trade actions: 10 req per 60s per user (high-cost operations) */
export const tradeRateLimit = new Ratelimit({
	redis,
	limiter: Ratelimit.slidingWindow(10, "60 s"),
	analytics: true,
	prefix: "ratelimit:trade",
});

/** Discogs API proxy: 5 req per 60s per user (external rate limit protection) */
export const discogsRateLimit = new Ratelimit({
	redis,
	limiter: Ratelimit.slidingWindow(5, "60 s"),
	analytics: true,
	prefix: "ratelimit:discogs",
});
