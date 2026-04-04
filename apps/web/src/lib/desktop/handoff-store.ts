import { Redis } from "@upstash/redis";

const HANDOFF_TTL_SECONDS = 30; // 30 s window for desktop to pick up the code

function getRedis(): Redis | null {
	if (!process.env.UPSTASH_REDIS_REST_URL || !process.env.UPSTASH_REDIS_REST_TOKEN) {
		return null;
	}
	return new Redis({
		url: process.env.UPSTASH_REDIS_REST_URL,
		token: process.env.UPSTASH_REDIS_REST_TOKEN,
	});
}

interface HandoffEntry {
	userId: string;
	createdAt: number;
}

/**
 * Store a single-use handoff code in Redis with a 30-second TTL.
 * Throws if Redis is not configured — the in-memory Map cannot be used in
 * serverless environments where each invocation runs in a fresh process.
 */
export async function storeHandoffCode(code: string, userId: string): Promise<void> {
	const redis = getRedis();
	if (!redis) {
		throw new Error(
			"Redis not configured — cannot store handoff code in serverless environment. " +
				"Set UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN.",
		);
	}
	const entry: HandoffEntry = { userId, createdAt: Date.now() };
	await redis.set(`handoff:${code}`, JSON.stringify(entry), { ex: HANDOFF_TTL_SECONDS });
}

/**
 * Atomically consume a handoff code: returns the associated userId on success,
 * null if the code does not exist or has already been used.
 */
export async function consumeHandoffCode(code: string): Promise<string | null> {
	const redis = getRedis();
	if (!redis) return null;

	const key = `handoff:${code}`;

	// SECURITY: Atomic GET+DEL via Lua script to prevent TOCTOU race condition.
	// Two concurrent requests can no longer both read the same code before deletion.
	const raw = await redis.eval(
		`local v = redis.call('GET', KEYS[1]); if v then redis.call('DEL', KEYS[1]); end; return v;`,
		[key],
		[],
	) as string | null;
	if (!raw) return null;

	const entry =
		typeof raw === "string" ? (JSON.parse(raw) as HandoffEntry) : (raw as HandoffEntry);
	return entry.userId;
}
