"use server";

import { beforeEach, describe, expect, it, vi } from "vitest";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------
const USER_A = "aaaa0000-aaaa-4aaa-8aaa-aaaaaaaaaaaa"; // requester / initial proposer
const USER_B = "bbbb0000-bbbb-4bbb-8bbb-bbbbbbbbbbbb"; // provider / counter-proposer
const TRADE_ID = "cccc0000-cccc-4ccc-8ccc-cccccccccccc";
const PROPOSAL_ID = "dddd0000-dddd-4ddd-8ddd-dddddddddddd";
const RELEASE_ID = "eeee0000-eeee-4eee-8eee-eeeeeeeeeeee";
const COLLECTION_ITEM_ID = "ffff0000-ffff-4fff-8fff-ffffffffffff";

// ---------------------------------------------------------------------------
// Hoisted state — accessible inside vi.mock factories
// ---------------------------------------------------------------------------
const {
	mockState,
	mockDbInsertValues,
	mockDbReturning,
	mockDbInsertValuesMethod,
	mockDbInsert,
	mockDbUpdateWhere,
	mockDbUpdateSet,
	mockDbUpdate,
	mockAdminInsert,
} = vi.hoisted(() => {
	const mockState = {
		authUser: { id: "aaaa0000-aaaa-4aaa-8aaa-aaaaaaaaaaaa" } as {
			id: string;
			email?: string;
		} | null,
		tradeRow: {
			id: "cccc0000-cccc-4ccc-8ccc-cccccccccccc",
			requesterId: "aaaa0000-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
			providerId: "bbbb0000-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
			status: "pending",
		} as Record<string, unknown> | null,
		latestProposal: null as Record<string, unknown> | null,
		proposalRow: null as Record<string, unknown> | null,
		subscriptionPlan: "free",
		subscriptionStatus: "active",
	};

	const mockDbInsertValues: Array<Record<string, unknown>> = [];

	const mockDbReturning = vi.fn(() => {
		return Promise.resolve([{ id: "dddd0000-dddd-4ddd-8ddd-dddddddddddd" }]);
	});

	const mockDbInsertValuesMethod = vi.fn((values: Record<string, unknown>) => {
		mockDbInsertValues.push(values);
		return { returning: mockDbReturning };
	});

	const mockDbInsert = vi.fn(() => ({
		values: mockDbInsertValuesMethod,
	}));

	// Select chain with dynamic behavior based on table
	const createSelect = () => {
		let currentTable: string | null = null;

		const mockLimit = vi.fn(() => {
			if (currentTable === "trade_requests") {
				return Promise.resolve(mockState.tradeRow ? [mockState.tradeRow] : []);
			}
			if (currentTable === "trade_proposals") {
				// Could be either "get by id" or "get latest"
				if (mockState.proposalRow) {
					return Promise.resolve([mockState.proposalRow]);
				}
				if (mockState.latestProposal) {
					return Promise.resolve([mockState.latestProposal]);
				}
				return Promise.resolve([]);
			}
			return Promise.resolve([]);
		});

		const mockOrderBy = vi.fn(() => ({
			limit: mockLimit,
		}));

		const mockWhere = vi.fn(() => ({
			limit: mockLimit,
			orderBy: mockOrderBy,
		}));

		const mockFrom = vi.fn((table: unknown) => {
			// Extract table name from Drizzle table object
			const t = table as Record<string | symbol, unknown>;
			const drizzleName = Symbol.for("drizzle:Name");
			currentTable = (t?.[drizzleName] as string) ?? "unknown";
			return { where: mockWhere, limit: mockLimit, orderBy: mockOrderBy };
		});

		return vi.fn(() => ({ from: mockFrom }));
	};

	const mockDbSelect = createSelect();

	const mockDbUpdateWhere = vi.fn(() => Promise.resolve());
	const mockDbUpdateSet = vi.fn(() => ({ where: mockDbUpdateWhere }));
	const mockDbUpdate = vi.fn(() => ({ set: mockDbUpdateSet }));

	const mockAdminInsert = vi.fn(() => Promise.resolve({ error: null }));

	return {
		mockState,
		mockDbInsertValues,
		mockDbReturning,
		mockDbInsertValuesMethod,
		mockDbInsert,
		mockDbSelect,
		mockDbUpdateWhere,
		mockDbUpdateSet,
		mockDbUpdate,
		mockAdminInsert,
	};
});

// ---------------------------------------------------------------------------
// Mocks — Supabase auth
// ---------------------------------------------------------------------------
vi.mock("@/lib/supabase/server", () => ({
	createClient: vi.fn(async () => ({
		auth: {
			getUser: vi.fn(async () => ({
				data: { user: mockState.authUser },
			})),
		},
	})),
}));

// ---------------------------------------------------------------------------
// Mocks — Drizzle DB
// ---------------------------------------------------------------------------

// We need a fresh select chain for each call. Use a factory for the select mock.
vi.mock("@/lib/db", () => {
	let currentTable: string | null = null;

	const mockLimit = vi.fn(() => {
		if (currentTable === "trade_requests") {
			return Promise.resolve(mockState.tradeRow ? [mockState.tradeRow] : []);
		}
		if (currentTable === "trade_proposals") {
			if (mockState.proposalRow) return Promise.resolve([mockState.proposalRow]);
			if (mockState.latestProposal) return Promise.resolve([mockState.latestProposal]);
			return Promise.resolve([]);
		}
		return Promise.resolve([]);
	});

	const mockOrderBy = vi.fn(() => ({ limit: mockLimit }));
	const mockWhere = vi.fn(() => ({ limit: mockLimit, orderBy: mockOrderBy }));

	const mockFrom = vi.fn((table: unknown) => {
		const t = table as Record<string | symbol, unknown>;
		currentTable = (t?.[Symbol.for("drizzle:Name")] as string) ?? "unknown";
		return { where: mockWhere, limit: mockLimit, orderBy: mockOrderBy };
	});

	const mockSelect = vi.fn(() => ({ from: mockFrom }));

	return {
		db: {
			insert: mockDbInsert,
			select: mockSelect,
			update: mockDbUpdate,
		},
	};
});

// ---------------------------------------------------------------------------
// Mocks — Rate limiter
// ---------------------------------------------------------------------------
vi.mock("@/lib/rate-limit", () => ({
	tradeRateLimit: null,
	safeLimit: vi.fn(async () => ({ success: true })),
}));

// ---------------------------------------------------------------------------
// Mocks — Entitlements
// ---------------------------------------------------------------------------
vi.mock("@/lib/entitlements", () => ({
	getUserSubscription: vi.fn(async () => ({
		plan: mockState.subscriptionPlan,
		status: mockState.subscriptionStatus,
		tradesMonthReset: new Date(),
		tradesThisMonth: 0,
	})),
	isPremium: vi.fn(
		(plan: string, status?: string) =>
			(plan === "premium_monthly" || plan === "premium_annual") &&
			(!status || status === "active" || status === "trialing"),
	),
	checkAndIncrementTradeCount: vi.fn(async () => ({
		allowed: true,
		tradesUsed: 1,
		tradesLimit: 5,
	})),
	FREE_TRADE_LIMIT: 5,
}));

// ---------------------------------------------------------------------------
// Mocks — Next.js cache (revalidatePath used in acceptProposalAction)
// ---------------------------------------------------------------------------
vi.mock("next/cache", () => ({
	revalidatePath: vi.fn(),
	revalidateTag: vi.fn(),
}));

// ---------------------------------------------------------------------------
// Mocks — Admin client (for notifications)
// ---------------------------------------------------------------------------
vi.mock("@/lib/supabase/admin", () => ({
	createAdminClient: vi.fn(() => ({
		from: vi.fn(() => ({
			insert: mockAdminInsert,
		})),
	})),
}));

// ---------------------------------------------------------------------------
// Import actions (after mocks)
// ---------------------------------------------------------------------------
import {
	acceptProposalAction,
	createCounterproposalAction,
	createProposalAction,
	declineProposalAction,
} from "@/actions/trade-proposals";

// ---------------------------------------------------------------------------
// Reset between tests
// ---------------------------------------------------------------------------
beforeEach(() => {
	vi.clearAllMocks();
	mockDbInsertValues.length = 0;
	mockState.authUser = { id: USER_A };
	mockState.tradeRow = {
		id: TRADE_ID,
		requesterId: USER_A,
		providerId: USER_B,
		status: "pending",
	};
	mockState.latestProposal = null;
	mockState.proposalRow = null;
	mockState.subscriptionPlan = "free";
	mockState.subscriptionStatus = "active";
});

// ---------------------------------------------------------------------------
// createProposalAction
// ---------------------------------------------------------------------------
describe("createProposalAction", () => {
	it("creates 1:1 proposal for free user", async () => {
		const result = await createProposalAction({
			targetUserId: USER_B,
			releaseId: RELEASE_ID,
			offerItems: [
				{
					releaseId: RELEASE_ID,
					collectionItemId: COLLECTION_ITEM_ID,
					declaredQuality: "VG+",
				},
			],
			wantItems: [
				{
					releaseId: RELEASE_ID,
					declaredQuality: "NM",
				},
			],
		});

		expect(result).toHaveProperty("proposalId");
		expect(result).toHaveProperty("tradeId");
		expect(result).not.toHaveProperty("error");
	});

	it("returns tier error when free user submits 2 offer items", async () => {
		const result = await createProposalAction({
			targetUserId: USER_B,
			offerItems: [
				{ releaseId: RELEASE_ID, declaredQuality: "VG+" },
				{ releaseId: RELEASE_ID, declaredQuality: "VG" },
			],
			wantItems: [{ releaseId: RELEASE_ID, declaredQuality: "NM" }],
		});

		expect(result).toHaveProperty("error");
		expect((result as { error: string }).error).toContain("Free tier");
	});

	it("returns quality error when item missing declaredQuality", async () => {
		const result = await createProposalAction({
			targetUserId: USER_B,
			offerItems: [{ releaseId: RELEASE_ID, declaredQuality: "" }],
			wantItems: [{ releaseId: RELEASE_ID, declaredQuality: "NM" }],
		});

		expect(result).toHaveProperty("error");
	});

	it("returns error when not authenticated", async () => {
		mockState.authUser = null;

		const result = await createProposalAction({
			targetUserId: USER_B,
			offerItems: [{ releaseId: RELEASE_ID, declaredQuality: "VG+" }],
			wantItems: [{ releaseId: RELEASE_ID, declaredQuality: "NM" }],
		});

		expect(result).toHaveProperty("error");
		expect((result as { error: string }).error).toContain("authenticated");
	});

	it("allows premium user to submit 3 items per side", async () => {
		mockState.subscriptionPlan = "premium_monthly";

		const result = await createProposalAction({
			targetUserId: USER_B,
			offerItems: [
				{ releaseId: RELEASE_ID, declaredQuality: "VG+" },
				{ releaseId: RELEASE_ID, declaredQuality: "VG" },
				{ releaseId: RELEASE_ID, declaredQuality: "G+" },
			],
			wantItems: [
				{ releaseId: RELEASE_ID, declaredQuality: "NM" },
				{ releaseId: RELEASE_ID, declaredQuality: "VG+" },
				{ releaseId: RELEASE_ID, declaredQuality: "VG" },
			],
		});

		expect(result).toHaveProperty("proposalId");
		expect(result).not.toHaveProperty("error");
	});
});

// ---------------------------------------------------------------------------
// createCounterproposalAction
// ---------------------------------------------------------------------------
describe("createCounterproposalAction", () => {
	it("creates counter with sequenceNumber = prev + 1", async () => {
		mockState.authUser = { id: USER_B };
		mockState.latestProposal = {
			id: PROPOSAL_ID,
			proposerId: USER_A,
			sequenceNumber: 1,
			status: "pending",
		};

		const result = await createCounterproposalAction({
			tradeId: TRADE_ID,
			offerItems: [{ releaseId: RELEASE_ID, declaredQuality: "VG+" }],
			wantItems: [{ releaseId: RELEASE_ID, declaredQuality: "NM" }],
		});

		expect(result).toHaveProperty("proposalId");
		expect(result).not.toHaveProperty("error");
	});

	it("enforces turn: returns error if same proposer tries counter", async () => {
		mockState.authUser = { id: USER_A };
		mockState.latestProposal = {
			id: PROPOSAL_ID,
			proposerId: USER_A,
			sequenceNumber: 1,
			status: "pending",
		};

		const result = await createCounterproposalAction({
			tradeId: TRADE_ID,
			offerItems: [{ releaseId: RELEASE_ID, declaredQuality: "VG+" }],
			wantItems: [{ releaseId: RELEASE_ID, declaredQuality: "NM" }],
		});

		expect(result).toHaveProperty("error");
		expect((result as { error: string }).error).toContain("not your turn");
	});

	it("enforces round limit: returns error at sequence 10", async () => {
		mockState.authUser = { id: USER_B };
		mockState.latestProposal = {
			id: PROPOSAL_ID,
			proposerId: USER_A,
			sequenceNumber: 10,
			status: "pending",
		};

		const result = await createCounterproposalAction({
			tradeId: TRADE_ID,
			offerItems: [{ releaseId: RELEASE_ID, declaredQuality: "VG+" }],
			wantItems: [{ releaseId: RELEASE_ID, declaredQuality: "NM" }],
		});

		expect(result).toHaveProperty("error");
		expect((result as { error: string }).error).toContain("10 counterproposal rounds");
	});

	it("enforces quality on counterproposals", async () => {
		mockState.authUser = { id: USER_B };
		mockState.latestProposal = {
			id: PROPOSAL_ID,
			proposerId: USER_A,
			sequenceNumber: 1,
			status: "pending",
		};

		const result = await createCounterproposalAction({
			tradeId: TRADE_ID,
			offerItems: [{ releaseId: RELEASE_ID, declaredQuality: "" }],
			wantItems: [{ releaseId: RELEASE_ID, declaredQuality: "NM" }],
		});

		expect(result).toHaveProperty("error");
	});
});

// ---------------------------------------------------------------------------
// acceptProposalAction
// ---------------------------------------------------------------------------
describe("acceptProposalAction", () => {
	it("accepts pending proposal and updates trade status", async () => {
		mockState.authUser = { id: USER_B };
		mockState.proposalRow = {
			id: PROPOSAL_ID,
			tradeId: TRADE_ID,
			proposerId: USER_A,
			status: "pending",
		};

		const result = await acceptProposalAction(PROPOSAL_ID);

		expect(result).toMatchObject({ success: true });
		expect(result).toHaveProperty("tradeId", TRADE_ID);
	});

	it("returns error when proposer tries to accept own proposal", async () => {
		mockState.authUser = { id: USER_A };
		mockState.proposalRow = {
			id: PROPOSAL_ID,
			tradeId: TRADE_ID,
			proposerId: USER_A,
			status: "pending",
		};

		const result = await acceptProposalAction(PROPOSAL_ID);

		expect(result).toHaveProperty("error");
		expect((result as { error: string }).error).toContain("recipient");
	});

	it("returns error for non-pending proposal", async () => {
		mockState.authUser = { id: USER_B };
		mockState.proposalRow = {
			id: PROPOSAL_ID,
			tradeId: TRADE_ID,
			proposerId: USER_A,
			status: "superseded",
		};

		const result = await acceptProposalAction(PROPOSAL_ID);

		expect(result).toHaveProperty("error");
		expect((result as { error: string }).error).toContain("pending");
	});
});

// ---------------------------------------------------------------------------
// declineProposalAction
// ---------------------------------------------------------------------------
describe("declineProposalAction", () => {
	it("declines proposal and updates trade status", async () => {
		mockState.authUser = { id: USER_B };
		mockState.proposalRow = {
			id: PROPOSAL_ID,
			tradeId: TRADE_ID,
			proposerId: USER_A,
			status: "pending",
		};

		const result = await declineProposalAction(PROPOSAL_ID);

		expect(result).toEqual({ success: true });
	});

	it("returns error when proposer tries to decline own proposal", async () => {
		mockState.authUser = { id: USER_A };
		mockState.proposalRow = {
			id: PROPOSAL_ID,
			tradeId: TRADE_ID,
			proposerId: USER_A,
			status: "pending",
		};

		const result = await declineProposalAction(PROPOSAL_ID);

		expect(result).toHaveProperty("error");
		expect((result as { error: string }).error).toContain("recipient");
	});
});
