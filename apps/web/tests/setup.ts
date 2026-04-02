import "@testing-library/jest-dom/vitest";
import { vi } from "vitest";

// React 19 requires this to be set for act() to work in test environments
// see: https://github.com/reactwg/react-18/discussions/102
(globalThis as Record<string, unknown>).IS_REACT_ACT_ENVIRONMENT = true;

// Default test harness: rate limiting should be deterministic and offline-safe.
// Individual suites can override these mocks when they need custom behavior.
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
