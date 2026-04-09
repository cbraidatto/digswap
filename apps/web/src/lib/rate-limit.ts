import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";
import { env } from "@/lib/env";

const redisUrl = env.UPSTASH_REDIS_REST_URL;
const redisToken = env.UPSTASH_REDIS_REST_TOKEN;

const redisAvailable = redisUrl.length > 0 && redisToken.length > 0;

const redis = redisAvailable ? new Redis({ url: redisUrl, token: redisToken }) : null;

/**
 * Safe rate limit wrapper.
 * - If Redis is available: delegates to the real limiter.
 * - If Redis is unavailable:
 *   - failClosed=true  -> denies the request (safe for auth flows)
 *   - failClosed=false -> allows the request (acceptable for lower-risk flows)
 */
export async function safeLimit(
	limiter: Ratelimit | null,
	key: string,
	failClosed = true,
): Promise<{ success: boolean }> {
	if (!limiter) {
		if (env.NODE_ENV === "production") {
			if (failClosed) {
				console.error("[rate-limit] Redis unavailable - failing closed");
			} else {
				console.warn(
					"[rate-limit] Redis unavailable - allowing request because limiter is fail-open",
				);
			}
		}
		return { success: !failClosed };
	}
	try {
		return await limiter.limit(key);
	} catch (err) {
		if (failClosed) {
			console.error("[rate-limit] Redis error:", err);
		} else if (env.NODE_ENV === "production") {
			console.warn("[rate-limit] Redis error - allowing request because limiter is fail-open", err);
		}
		return { success: !failClosed };
	}
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function makeRatelimit(limiter: any, prefix: string): Ratelimit | null {
	if (!redis) return null;
	return new Ratelimit({
		redis,
		limiter,
		analytics: true,
		prefix,
	});
}

/**
 * Auth endpoints rate limiter: 5 attempts per 60 seconds per IP.
 * Apply to login, signup endpoints to prevent brute force attacks.
 * Per D-16: Rate limiting on all auth endpoints.
 * failClosed=true - Redis outage denies auth, preventing brute force bypass.
 */
export const authRateLimit = makeRatelimit(Ratelimit.slidingWindow(5, "60 s"), "ratelimit:auth");

/**
 * Password reset rate limiter: 3 attempts per 15 minutes per email.
 * Prevents abuse of the password reset flow.
 */
export const resetRateLimit = makeRatelimit(Ratelimit.slidingWindow(3, "15 m"), "ratelimit:reset");

/**
 * TOTP verification rate limiter: 5 attempts per 5 minutes per user ID.
 * Prevents brute force of 2FA codes.
 */
export const totpRateLimit = makeRatelimit(Ratelimit.slidingWindow(5, "5 m"), "ratelimit:totp");

/** General API actions: 30 req per 60s per user */
export const apiRateLimit = makeRatelimit(Ratelimit.slidingWindow(30, "60 s"), "ratelimit:api");

/** Trade actions: 10 req per 60s per user */
export const tradeRateLimit = makeRatelimit(Ratelimit.slidingWindow(10, "60 s"), "ratelimit:trade");

/** Discogs API proxy: 5 req per 60s per user */
export const discogsRateLimit = makeRatelimit(
	Ratelimit.slidingWindow(5, "60 s"),
	"ratelimit:discogs",
);
