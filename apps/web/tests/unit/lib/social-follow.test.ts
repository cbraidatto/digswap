import { beforeEach, describe, expect, it, vi } from "vitest";

// ---------------------------------------------------------------------------
// Mocks — logActivity uses validation + db.insert
// ---------------------------------------------------------------------------

const USER_ID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";

let insertCalled = false;
let insertedValues: Record<string, unknown> | null = null;

vi.mock("@/lib/db", () => {
	const chain: Record<string, unknown> = {};

	chain.insert = vi.fn().mockImplementation(() => ({
		values: vi.fn().mockImplementation((vals: Record<string, unknown>) => {
			insertCalled = true;
			insertedValues = vals;
			return Promise.resolve();
		}),
	}));

	return { db: chain };
});

vi.mock("@/lib/db/schema/social", () => ({
	activityFeed: {
		id: "id",
		userId: "user_id",
		actionType: "action_type",
		targetType: "target_type",
		targetId: "target_id",
		metadata: "metadata",
	},
}));

vi.mock("@/lib/validations/social", () => ({
	logActivitySchema: {
		safeParse: vi.fn((data: Record<string, unknown>) => {
			// Basic validation: userId must be a UUID-like string, actionType required
			if (!data.userId || typeof data.userId !== "string" || data.userId.length < 10) {
				return { success: false, error: { issues: [{ message: "Invalid" }] } };
			}
			if (!data.actionType || typeof data.actionType !== "string" || data.actionType.length === 0) {
				return { success: false, error: { issues: [{ message: "Invalid actionType" }] } };
			}
			return { success: true, data };
		}),
	},
}));

const { logActivity } = await import("@/lib/social/log-activity");

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

beforeEach(() => {
	insertCalled = false;
	insertedValues = null;
	vi.clearAllMocks();
});

describe("logActivity", () => {
	it("inserts a valid activity into the feed", async () => {
		await logActivity(USER_ID, "collection_add", "release", "rel-123", null);

		expect(insertCalled).toBe(true);
		expect(insertedValues).toEqual({
			userId: USER_ID,
			actionType: "collection_add",
			targetType: "release",
			targetId: "rel-123",
			metadata: null,
		});
	});

	it("inserts activity with metadata", async () => {
		const meta = { source: "discogs", count: 5 };
		await logActivity(USER_ID, "import_complete", null, null, meta);

		expect(insertCalled).toBe(true);
		expect(insertedValues?.metadata).toEqual(meta);
	});

	it("silently skips on validation failure (bad userId)", async () => {
		await logActivity("bad", "collection_add", null, null, null);

		expect(insertCalled).toBe(false);
	});

	it("silently skips on validation failure (empty actionType)", async () => {
		await logActivity(USER_ID, "", null, null, null);

		expect(insertCalled).toBe(false);
	});

	it("does not throw on db insert error", async () => {
		// Override insert to throw
		const { db } = await import("@/lib/db");
		(db.insert as ReturnType<typeof vi.fn>).mockImplementationOnce(() => ({
			values: vi.fn().mockRejectedValue(new Error("DB down")),
		}));

		// Should not throw
		await expect(
			logActivity(USER_ID, "follow", "user", "target-user", null),
		).resolves.toBeUndefined();
	});

	it("handles null targetType and targetId", async () => {
		await logActivity(USER_ID, "profile_update", null, null, null);

		expect(insertCalled).toBe(true);
		expect(insertedValues?.targetType).toBeNull();
		expect(insertedValues?.targetId).toBeNull();
	});
});
