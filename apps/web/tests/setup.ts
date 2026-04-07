import "@testing-library/jest-dom/vitest";
import { vi } from "vitest";

// React 19 requires this to be set for act() to work in test environments
// see: https://github.com/reactwg/react-18/discussions/102
(globalThis as Record<string, unknown>).IS_REACT_ACT_ENVIRONMENT = true;

// Default test harness: rate limiting should be deterministic and offline-safe.
// Individual suites can override these mocks when they need custom behavior.
vi.mock("@upstash/redis", () => {
	// Shared in-memory store across all MockRedis instances in the same test run.
	// This allows storeHandoffCode + consumeHandoffCode to share state even though
	// handoff-store.ts creates a new Redis() instance per call.
	const sharedStore = new Map<string, string>();

	class MockRedis {
		url: string;
		token: string;

		constructor(opts: { url: string; token: string }) {
			this.url = opts.url;
			this.token = opts.token;
		}

		async set(key: string, value: string, _opts?: unknown) {
			sharedStore.set(key, value);
		}

		async get(key: string) {
			return sharedStore.get(key) ?? null;
		}

		async del(key: string) {
			sharedStore.delete(key);
		}

		async eval(_script: string, keys: string[], _args: unknown[]) {
			// Simulate atomic GET+DEL Lua script used by handoff-store
			const key = keys[0];
			const value = sharedStore.get(key) ?? null;
			if (value !== null) {
				sharedStore.delete(key);
			}
			return value;
		}

		async expire(_key: string, _ttl: number) {
			// no-op in tests — TTL is not needed
		}

		async incr(key: string) {
			const val = Number(sharedStore.get(key) ?? "0") + 1;
			sharedStore.set(key, String(val));
			return val;
		}
	}

	return { Redis: MockRedis };
});

vi.mock("@upstash/ratelimit", () => {
	class MockRatelimit {
		config: Record<string, unknown>;

		static slidingWindow(tokens: number, window: string) {
			return { type: "slidingWindow", tokens, window };
		}

		constructor(config: Record<string, unknown>) {
			this.config = config;
		}

		async limit(_identifier: string) {
			return {
				success: true,
				limit: 100,
				remaining: 99,
				reset: Date.now() + 60_000,
			};
		}
	}

	return { Ratelimit: MockRatelimit };
});
