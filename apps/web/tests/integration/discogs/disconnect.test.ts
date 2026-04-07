import { beforeEach, describe, expect, test, vi } from "vitest";

// -- Track all admin calls for assertions --
const adminCalls: { table: string; method: string; args: unknown[] }[] = [];

function createTrackedChain(table: string) {
	const chain: Record<string, ReturnType<typeof vi.fn>> = {};
	chain.select = vi.fn((...args: unknown[]) => {
		adminCalls.push({ table, method: "select", args });
		return chain;
	});
	chain.update = vi.fn((...args: unknown[]) => {
		adminCalls.push({ table, method: "update", args });
		return chain;
	});
	chain.delete = vi.fn((...args: unknown[]) => {
		adminCalls.push({ table, method: "delete", args });
		return chain;
	});
	chain.insert = vi.fn((...args: unknown[]) => {
		adminCalls.push({ table, method: "insert", args });
		return chain;
	});
	chain.eq = vi.fn().mockReturnValue(chain);
	chain.in = vi.fn().mockReturnValue(chain);
	chain.single = vi.fn().mockResolvedValue({ data: null, error: null });
	chain.maybeSingle = vi.fn().mockResolvedValue({ data: null, error: null });
	return chain;
}

vi.mock("@/lib/supabase/admin", () => ({
	createAdminClient: vi.fn(() => ({
		from: vi.fn((table: string) => createTrackedChain(table)),
	})),
}));

// -- Mock Supabase server client --
const mockGetUser = vi.fn();

vi.mock("@/lib/supabase/server", () => ({
	createClient: vi.fn().mockResolvedValue({
		auth: {
			getUser: () => mockGetUser(),
		},
	}),
}));

// -- Mock OAuth token deletion --
const mockDeleteTokens = vi.fn().mockResolvedValue(undefined);

vi.mock("@/lib/discogs/oauth", () => ({
	deleteTokens: (...args: unknown[]) => mockDeleteTokens(...args),
	getRequestToken: vi.fn(),
}));

vi.mock("@/lib/rate-limit", () => ({
	discogsRateLimit: {},
	safeLimit: vi.fn().mockResolvedValue({ success: true }),
}));

// -- Mock next/headers --
vi.mock("next/headers", () => ({
	cookies: vi.fn().mockResolvedValue({
		get: vi.fn(),
		set: vi.fn(),
		delete: vi.fn(),
	}),
}));

// -- Mock next/navigation --
vi.mock("next/navigation", () => ({
	redirect: vi.fn(),
}));

import { disconnectDiscogs } from "@/actions/discogs";

describe("Discogs disconnect", () => {
	const USER_ID = "user-disconnect-123";

	beforeEach(() => {
		vi.clearAllMocks();
		adminCalls.length = 0;
		mockGetUser.mockResolvedValue({
			data: { user: { id: USER_ID } },
		});
	});

	test("deletes collection_items with added_via=discogs filter", async () => {
		const result = await disconnectDiscogs();

		expect(result).toEqual({ success: true });

		const collectionDeletes = adminCalls.filter(
			(c) => c.table === "collection_items" && c.method === "delete",
		);
		expect(collectionDeletes.length).toBeGreaterThanOrEqual(1);
	});

	test("deletes wantlist_items with added_via=discogs filter", async () => {
		await disconnectDiscogs();

		const wantlistDeletes = adminCalls.filter(
			(c) => c.table === "wantlist_items" && c.method === "delete",
		);
		expect(wantlistDeletes.length).toBeGreaterThanOrEqual(1);
	});

	test("clears profile discogs fields", async () => {
		await disconnectDiscogs();

		const profileUpdates = adminCalls.filter(
			(c) => c.table === "profiles" && c.method === "update",
		);
		expect(profileUpdates.length).toBeGreaterThanOrEqual(1);

		// Verify the update payload contains the expected fields
		const updateArgs = profileUpdates[0].args[0] as Record<string, unknown>;
		expect(updateArgs).toEqual(
			expect.objectContaining({
				discogs_connected: false,
				discogs_username: null,
				last_synced_at: null,
			}),
		);
	});

	test("deletes stored OAuth tokens", async () => {
		await disconnectDiscogs();

		expect(mockDeleteTokens).toHaveBeenCalledWith(USER_ID);
	});

	test("does NOT touch the releases table", async () => {
		await disconnectDiscogs();

		const releaseOperations = adminCalls.filter(
			(c) => c.table === "releases" && c.method === "delete",
		);
		expect(releaseOperations).toHaveLength(0);
	});

	test("cancels active import jobs", async () => {
		await disconnectDiscogs();

		const jobUpdates = adminCalls.filter((c) => c.table === "import_jobs" && c.method === "update");
		expect(jobUpdates.length).toBeGreaterThanOrEqual(1);
	});
});
