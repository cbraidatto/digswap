import { beforeEach, describe, expect, it, vi } from "vitest";

const { mockDbExecute } = vi.hoisted(() => ({
	mockDbExecute: vi.fn(),
}));

vi.mock("@/lib/db", () => ({
	db: {
		execute: mockDbExecute,
	},
}));

const { GET } = await import("@/app/api/health/route");

beforeEach(() => {
	vi.clearAllMocks();
});

describe("Health check route", () => {
	it("returns 200 with status 'healthy' when DB is reachable", async () => {
		mockDbExecute.mockResolvedValue([{ "?column?": 1 }]);

		const response = await GET();
		const body = await response.json();

		expect(response.status).toBe(200);
		expect(body.status).toBe("healthy");
		expect(body.checks.database).toBe("ok");
	});

	it("returns 503 with status 'degraded' when DB fails", async () => {
		mockDbExecute.mockRejectedValue(new Error("connection refused"));

		const response = await GET();
		const body = await response.json();

		expect(response.status).toBe(503);
		expect(body.status).toBe("degraded");
		expect(body.checks.database).toBe("error");
	});

	it("includes a timestamp in ISO 8601 format", async () => {
		mockDbExecute.mockResolvedValue([{ "?column?": 1 }]);

		const response = await GET();
		const body = await response.json();

		// Verify it's a valid ISO date string
		const parsed = new Date(body.timestamp);
		expect(parsed.toISOString()).toBe(body.timestamp);
	});
});
