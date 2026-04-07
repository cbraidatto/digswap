import { beforeEach, describe, expect, test, vi } from "vitest";

// -- Mock admin client --
function createChainedMock(resolveValue: unknown = { data: null, error: null }) {
	const chain: Record<string, ReturnType<typeof vi.fn>> = {};
	chain.select = vi.fn().mockReturnValue(chain);
	chain.insert = vi.fn().mockReturnValue(chain);
	chain.update = vi.fn().mockReturnValue(chain);
	chain.eq = vi.fn().mockReturnValue(chain);
	chain.in = vi.fn().mockReturnValue(chain);
	chain.single = vi.fn().mockResolvedValue(resolveValue);
	return chain;
}

vi.mock("@/lib/supabase/admin", () => ({
	createAdminClient: vi.fn(() => ({
		from: vi.fn(() =>
			createChainedMock({
				data: {
					id: "job-123",
					user_id: "user-123",
					type: "collection",
					status: "completed",
					current_page: 1,
				},
				error: null,
			}),
		),
	})),
}));

// -- Mock import worker --
vi.mock("@/lib/discogs/import-worker", () => ({
	processImportPage: vi.fn().mockResolvedValue({ done: true }),
	processWantlistPage: vi.fn().mockResolvedValue({ done: true }),
}));

// -- Mock broadcast --
vi.mock("@/lib/discogs/broadcast", () => ({
	broadcastProgress: vi.fn().mockResolvedValue(undefined),
}));

// Mock global fetch
vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true }));

import { POST } from "@/app/api/discogs/import/route";

describe("Import API route integration", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		process.env.IMPORT_WORKER_SECRET = "test_worker_secret";
		process.env.NEXT_PUBLIC_SITE_URL = "http://localhost:3000";
	});

	function createRequest(body: Record<string, unknown>, authToken?: string) {
		const headers = new Headers();
		headers.set("Content-Type", "application/json");
		if (authToken) {
			headers.set("Authorization", `Bearer ${authToken}`);
		}

		return {
			headers,
			json: vi.fn().mockResolvedValue(body),
		} as unknown as Parameters<typeof POST>[0];
	}

	test("rejects unauthorized requests with 401", async () => {
		const request = createRequest({ jobId: "job-123" });

		const response = await POST(request);

		expect(response.status).toBe(401);
	});

	test("rejects requests with wrong secret with 401", async () => {
		const request = createRequest({ jobId: "job-123" }, "wrong_secret");

		const response = await POST(request);

		expect(response.status).toBe(401);
	});

	test("authenticates with correct IMPORT_WORKER_SECRET", async () => {
		const request = createRequest({ jobId: "job-123" }, "test_worker_secret");

		const response = await POST(request);

		// Completed job returns 200 (idempotency guard)
		expect(response.status).toBe(200);
	});

	test("returns 400 for missing jobId", async () => {
		const request = createRequest({}, "test_worker_secret");

		const response = await POST(request);

		expect(response.status).toBe(400);
	});

	test("completed jobs get early 200 response", async () => {
		const request = createRequest({ jobId: "job-123" }, "test_worker_secret");

		const response = await POST(request);
		const body = await response.json();

		expect(response.status).toBe(200);
		expect(body.message).toBe("Job already finished");
	});
});
