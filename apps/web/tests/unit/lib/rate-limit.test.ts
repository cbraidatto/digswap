import { beforeEach, describe, expect, it, vi } from "vitest";

// Mock Upstash Redis as a class
vi.mock("@upstash/redis", () => {
	class MockRedis {
		url: string;
		token: string;
		constructor(opts: { url: string; token: string }) {
			this.url = opts.url;
			this.token = opts.token;
		}
	}
	return { Redis: MockRedis };
});

// Mock Upstash Ratelimit as a class
vi.mock("@upstash/ratelimit", () => {
	class MockRatelimit {
		config: Record<string, unknown>;
		static instances: MockRatelimit[] = [];
		static slidingWindow(tokens: number, window: string) {
			return { type: "slidingWindow", tokens, window };
		}
		constructor(config: Record<string, unknown>) {
			this.config = config;
			MockRatelimit.instances.push(this);
		}
		async limit(_identifier: string) {
			return { success: true, limit: 5, remaining: 4, reset: 0 };
		}
	}
	return { Ratelimit: MockRatelimit };
});

beforeEach(() => {
	process.env.UPSTASH_REDIS_REST_URL = "https://test.upstash.io";
	process.env.UPSTASH_REDIS_REST_TOKEN = "test-token";
});

describe("Rate Limiters", () => {
	it("authRateLimit is exported", async () => {
		const { authRateLimit } = await import("@/lib/rate-limit");
		expect(authRateLimit).toBeDefined();
	});

	it("resetRateLimit is exported", async () => {
		const { resetRateLimit } = await import("@/lib/rate-limit");
		expect(resetRateLimit).toBeDefined();
	});

	it("totpRateLimit is exported", async () => {
		const { totpRateLimit } = await import("@/lib/rate-limit");
		expect(totpRateLimit).toBeDefined();
	});

	it("rate limiters are instances of Ratelimit", async () => {
		const { Ratelimit } = await import("@upstash/ratelimit");
		const { authRateLimit, resetRateLimit, totpRateLimit } = await import("@/lib/rate-limit");
		expect(authRateLimit).toBeInstanceOf(Ratelimit);
		expect(resetRateLimit).toBeInstanceOf(Ratelimit);
		expect(totpRateLimit).toBeInstanceOf(Ratelimit);
	});
});
