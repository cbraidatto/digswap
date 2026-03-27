import { describe, it, expect, vi, beforeEach } from "vitest";

// We test isP2PEnabled directly -- it reads process.env.P2P_ENABLED
// Must clear module cache between tests to re-evaluate the function
// with different env values.

describe("isP2PEnabled", () => {
	const originalEnv = process.env;

	beforeEach(() => {
		vi.resetModules();
		process.env = { ...originalEnv };
	});

	afterAll(() => {
		process.env = originalEnv;
	});

	it("returns true when P2P_ENABLED=true", async () => {
		process.env.P2P_ENABLED = "true";
		const { isP2PEnabled } = await import("@/lib/trades/constants");

		expect(isP2PEnabled()).toBe(true);
	});

	it("returns false when P2P_ENABLED is unset", async () => {
		delete process.env.P2P_ENABLED;
		const { isP2PEnabled } = await import("@/lib/trades/constants");

		expect(isP2PEnabled()).toBe(false);
	});

	it("returns false when P2P_ENABLED=false", async () => {
		process.env.P2P_ENABLED = "false";
		const { isP2PEnabled } = await import("@/lib/trades/constants");

		expect(isP2PEnabled()).toBe(false);
	});
});

// Need the afterAll import for vitest
import { afterAll } from "vitest";
