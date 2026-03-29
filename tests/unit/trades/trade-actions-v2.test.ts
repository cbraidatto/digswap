import { describe, it, expect, vi, beforeEach } from "vitest";

// ---------------------------------------------------------------------------
// Supabase auth mock
// ---------------------------------------------------------------------------
const mockGetUser = vi.fn();

vi.mock("@/lib/supabase/server", () => ({
	createClient: vi.fn(async () => ({
		auth: { getUser: mockGetUser },
	})),
}));

// ---------------------------------------------------------------------------
// Supabase admin client mock (chainable query pattern)
// ---------------------------------------------------------------------------
const mockFrom = vi.fn();
const mockRpc = vi.fn();
const mockAdminAuth = {
	admin: { getUserById: vi.fn() },
};

vi.mock("@/lib/supabase/admin", () => ({
	createAdminClient: vi.fn(() => ({
		from: mockFrom,
		rpc: mockRpc,
		auth: mockAdminAuth,
	})),
}));

// ---------------------------------------------------------------------------
// Helper: build a chainable Supabase query mock
// ---------------------------------------------------------------------------
function createQueryChain(result: { data?: unknown; error?: unknown }) {
	const chain: Record<string, unknown> = {};
	const methods = [
		"select",
		"eq",
		"neq",
		"single",
		"maybeSingle",
		"insert",
		"update",
		"in",
		"or",
		"order",
	];
	for (const method of methods) {
		chain[method] = vi.fn().mockReturnValue(chain);
	}
	chain.then = (resolve: (v: unknown) => void) => resolve(result);
	return chain;
}

// ---------------------------------------------------------------------------
// Mock dependencies
// ---------------------------------------------------------------------------
vi.mock("@/lib/rate-limit", () => ({
	tradeRateLimit: { limit: vi.fn(() => ({ success: true })) },
}));

vi.mock("@/lib/db", () => ({
	db: { execute: vi.fn() },
}));

vi.mock("@/actions/social", () => ({
	logActivity: vi.fn(),
}));

vi.mock("@/lib/gamification/badge-awards", () => ({
	awardBadge: vi.fn().mockResolvedValue(true),
}));

vi.mock("@/lib/gamification/constants", () => ({
	CONTRIBUTION_POINTS: { trade_completed: 15 },
}));

vi.mock("@/lib/trades/constants", () => ({
	TRADE_STATUS: {
		PENDING: "pending",
		LOBBY: "lobby",
		PREVIEWING: "previewing",
		ACCEPTED: "accepted",
		TRANSFERRING: "transferring",
		COMPLETED: "completed",
		DECLINED: "declined",
		CANCELLED: "cancelled",
		EXPIRED: "expired",
	},
	TRADE_EXPIRY_HOURS: 24,
	MAX_FREE_TRADES_PER_MONTH: 5,
	isP2PEnabled: vi.fn().mockReturnValue(true),
}));

const mockGetTradeCountThisMonth = vi.fn();
vi.mock("@/lib/trades/queries", () => ({
	getTradeCountThisMonth: (...args: unknown[]) =>
		mockGetTradeCountThisMonth(...args),
}));

// ---------------------------------------------------------------------------
// Import after mocks
// ---------------------------------------------------------------------------
import {
	createTrade,
	acceptTerms,
	declineTerms,
	acceptPreview,
	completeTrade,
	skipReview,
} from "@/actions/trades";

// ===========================================================================
// createTrade — Trade V2 specific tests
// ===========================================================================

describe("createTrade (V2 proposal)", () => {
	const validFormData = {
		providerId: "provider-1",
		releaseId: "release-1",
		offeringReleaseId: "offering-release-1",
		declaredQuality: "FLAC",
		conditionNotes: "Original pressing, clean copy, no pops or clicks",
		message: "Great record!",
	};

	beforeEach(() => {
		vi.clearAllMocks();
		mockGetUser.mockResolvedValue({
			data: { user: { id: "user-1" } },
		});
		mockGetTradeCountThisMonth.mockResolvedValue({
			count: 2,
			resetDate: null,
			plan: "free",
		});
	});

	it("sets initial status to lobby", async () => {
		// Track the insert call arguments
		const insertChain = createQueryChain({ data: { id: "trade-1" } });
		const insertSpy = insertChain.insert as ReturnType<typeof vi.fn>;

		mockFrom.mockImplementation((table: string) => {
			if (table === "profiles") {
				return createQueryChain({
					data: { trades_tos_accepted_at: "2026-01-01T00:00:00Z" },
				});
			}
			if (table === "trade_requests") return insertChain;
			if (table === "notifications") return createQueryChain({ error: null });
			return createQueryChain({ data: null });
		});

		const result = await createTrade(validFormData);

		expect(result.success).toBe(true);
		// Verify insert was called with an object containing status: "lobby"
		expect(insertSpy).toHaveBeenCalledWith(
			expect.objectContaining({ status: "lobby" }),
		);
	});

	it("accepts offeringReleaseId and conditionNotes", async () => {
		const insertChain = createQueryChain({ data: { id: "trade-1" } });
		const insertSpy = insertChain.insert as ReturnType<typeof vi.fn>;

		mockFrom.mockImplementation((table: string) => {
			if (table === "profiles") {
				return createQueryChain({
					data: { trades_tos_accepted_at: "2026-01-01T00:00:00Z" },
				});
			}
			if (table === "trade_requests") return insertChain;
			if (table === "notifications") return createQueryChain({ error: null });
			return createQueryChain({ data: null });
		});

		await createTrade(validFormData);

		expect(insertSpy).toHaveBeenCalledWith(
			expect.objectContaining({
				offering_release_id: "offering-release-1",
				condition_notes: "Original pressing, clean copy, no pops or clicks",
				declared_quality: "FLAC",
			}),
		);
	});

	it("rejects conditionNotes shorter than 10 chars", async () => {
		mockFrom.mockImplementation((table: string) => {
			if (table === "profiles") {
				return createQueryChain({
					data: { trades_tos_accepted_at: "2026-01-01T00:00:00Z" },
				});
			}
			return createQueryChain({ data: null });
		});

		const result = await createTrade({
			...validFormData,
			conditionNotes: "short",
		});

		expect(result.error).toBe("Condition notes must be at least 10 characters");
	});

	it("sets terms_accepted_at on creation (proposer implicit accept)", async () => {
		const insertChain = createQueryChain({ data: { id: "trade-1" } });
		const insertSpy = insertChain.insert as ReturnType<typeof vi.fn>;

		mockFrom.mockImplementation((table: string) => {
			if (table === "profiles") {
				return createQueryChain({
					data: { trades_tos_accepted_at: "2026-01-01T00:00:00Z" },
				});
			}
			if (table === "trade_requests") return insertChain;
			if (table === "notifications") return createQueryChain({ error: null });
			return createQueryChain({ data: null });
		});

		await createTrade(validFormData);

		expect(insertSpy).toHaveBeenCalledWith(
			expect.objectContaining({
				terms_accepted_at: expect.any(String),
			}),
		);
	});

	it("rejects missing offeringReleaseId", async () => {
		mockFrom.mockImplementation((table: string) => {
			if (table === "profiles") {
				return createQueryChain({
					data: { trades_tos_accepted_at: "2026-01-01T00:00:00Z" },
				});
			}
			return createQueryChain({ data: null });
		});

		const result = await createTrade({
			...validFormData,
			offeringReleaseId: "",
		});

		expect(result.error).toBe("You must select a release you're offering");
	});

	it("rejects missing declaredQuality", async () => {
		mockFrom.mockImplementation((table: string) => {
			if (table === "profiles") {
				return createQueryChain({
					data: { trades_tos_accepted_at: "2026-01-01T00:00:00Z" },
				});
			}
			return createQueryChain({ data: null });
		});

		const result = await createTrade({
			...validFormData,
			declaredQuality: "",
		});

		expect(result.error).toBe("Declared quality is required");
	});
});

// ===========================================================================
// acceptTerms — Bilateral negotiation
// ===========================================================================

describe("acceptTerms", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		mockGetUser.mockResolvedValue({
			data: { user: { id: "user-1" } },
		});
	});

	it("sets terms_accepted_at for requester", async () => {
		const updateChain = createQueryChain({ data: { id: "trade-1" }, error: null });
		const updateSpy = updateChain.update as ReturnType<typeof vi.fn>;

		// First call: select trade; second call: update
		let callCount = 0;
		mockFrom.mockImplementation((table: string) => {
			if (table === "trade_requests") {
				callCount++;
				if (callCount === 1) {
					// select for initial fetch
					return createQueryChain({
						data: {
							id: "trade-1",
							requester_id: "user-1",
							provider_id: "provider-1",
							status: "lobby",
							terms_accepted_at: null,
							terms_accepted_by_recipient_at: null,
						},
					});
				}
				return updateChain;
			}
			return createQueryChain({ data: null });
		});

		const result = await acceptTerms("trade-1");

		expect(result.success).toBe(true);
		expect(updateSpy).toHaveBeenCalledWith(
			expect.objectContaining({
				terms_accepted_at: expect.any(String),
			}),
		);
	});

	it("sets terms_accepted_by_recipient_at for provider", async () => {
		const updateChain = createQueryChain({ data: { id: "trade-1" }, error: null });
		const updateSpy = updateChain.update as ReturnType<typeof vi.fn>;

		let callCount = 0;
		mockFrom.mockImplementation((table: string) => {
			if (table === "trade_requests") {
				callCount++;
				if (callCount === 1) {
					return createQueryChain({
						data: {
							id: "trade-1",
							requester_id: "requester-1",
							provider_id: "user-1", // current user is provider
							status: "lobby",
							terms_accepted_at: null,
							terms_accepted_by_recipient_at: null,
						},
					});
				}
				return updateChain;
			}
			return createQueryChain({ data: null });
		});

		const result = await acceptTerms("trade-1");

		expect(result.success).toBe(true);
		expect(updateSpy).toHaveBeenCalledWith(
			expect.objectContaining({
				terms_accepted_by_recipient_at: expect.any(String),
			}),
		);
	});

	it("returns bothAccepted=true when other party already accepted", async () => {
		const updateChain = createQueryChain({ data: { id: "trade-1" }, error: null });

		let callCount = 0;
		mockFrom.mockImplementation((table: string) => {
			if (table === "trade_requests") {
				callCount++;
				if (callCount === 1) {
					return createQueryChain({
						data: {
							id: "trade-1",
							requester_id: "user-1",
							provider_id: "provider-1",
							status: "lobby",
							terms_accepted_at: null, // requester hasn't accepted yet
							terms_accepted_by_recipient_at: "2026-03-29T00:00:00Z", // provider already accepted
						},
					});
				}
				return updateChain;
			}
			return createQueryChain({ data: null });
		});

		const result = await acceptTerms("trade-1");

		expect(result.success).toBe(true);
		expect(result.bothAccepted).toBe(true);
	});

	it("returns bothAccepted=false when only one party accepted", async () => {
		const updateChain = createQueryChain({ data: { id: "trade-1" }, error: null });

		let callCount = 0;
		mockFrom.mockImplementation((table: string) => {
			if (table === "trade_requests") {
				callCount++;
				if (callCount === 1) {
					return createQueryChain({
						data: {
							id: "trade-1",
							requester_id: "user-1",
							provider_id: "provider-1",
							status: "lobby",
							terms_accepted_at: null,
							terms_accepted_by_recipient_at: null, // neither accepted
						},
					});
				}
				return updateChain;
			}
			return createQueryChain({ data: null });
		});

		const result = await acceptTerms("trade-1");

		expect(result.success).toBe(true);
		expect(result.bothAccepted).toBe(false);
	});

	it("rejects when trade not in lobby status", async () => {
		mockFrom.mockImplementation((table: string) => {
			if (table === "trade_requests") {
				return createQueryChain({
					data: {
						id: "trade-1",
						requester_id: "user-1",
						provider_id: "provider-1",
						status: "pending",
						terms_accepted_at: null,
						terms_accepted_by_recipient_at: null,
					},
				});
			}
			return createQueryChain({ data: null });
		});

		const result = await acceptTerms("trade-1");

		expect(result.error).toBe("Trade is not in lobby phase");
	});

	it("rejects non-participants", async () => {
		mockFrom.mockImplementation((table: string) => {
			if (table === "trade_requests") {
				return createQueryChain({
					data: {
						id: "trade-1",
						requester_id: "other-user-a",
						provider_id: "other-user-b",
						status: "lobby",
						terms_accepted_at: null,
						terms_accepted_by_recipient_at: null,
					},
				});
			}
			return createQueryChain({ data: null });
		});

		const result = await acceptTerms("trade-1");

		expect(result.error).toBe("Not a participant in this trade");
	});
});

// ===========================================================================
// declineTerms
// ===========================================================================

describe("declineTerms", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		mockGetUser.mockResolvedValue({
			data: { user: { id: "user-1" } },
		});
	});

	it("sets status to declined", async () => {
		const updateChain = createQueryChain({ data: { id: "trade-1" }, error: null });
		const updateSpy = updateChain.update as ReturnType<typeof vi.fn>;

		let callCount = 0;
		mockFrom.mockImplementation((table: string) => {
			if (table === "trade_requests") {
				callCount++;
				if (callCount === 1) {
					return createQueryChain({
						data: {
							id: "trade-1",
							requester_id: "user-1",
							provider_id: "provider-1",
							status: "lobby",
						},
					});
				}
				return updateChain;
			}
			return createQueryChain({ data: null });
		});

		const result = await declineTerms("trade-1");

		expect(result.success).toBe(true);
		expect(updateSpy).toHaveBeenCalledWith(
			expect.objectContaining({
				status: "declined",
			}),
		);
	});

	it("rejects non-participants", async () => {
		mockFrom.mockImplementation((table: string) => {
			if (table === "trade_requests") {
				return createQueryChain({
					data: {
						id: "trade-1",
						requester_id: "other-a",
						provider_id: "other-b",
						status: "lobby",
					},
				});
			}
			return createQueryChain({ data: null });
		});

		const result = await declineTerms("trade-1");

		expect(result.error).toBe("Not a participant in this trade");
	});

	it("rejects when trade not in lobby status", async () => {
		mockFrom.mockImplementation((table: string) => {
			if (table === "trade_requests") {
				return createQueryChain({
					data: {
						id: "trade-1",
						requester_id: "user-1",
						provider_id: "provider-1",
						status: "previewing",
					},
				});
			}
			return createQueryChain({ data: null });
		});

		const result = await declineTerms("trade-1");

		expect(result.error).toBe("Trade is not in lobby phase");
	});
});

// ===========================================================================
// acceptPreview — Bilateral preview acceptance
// ===========================================================================

describe("acceptPreview", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		mockGetUser.mockResolvedValue({
			data: { user: { id: "user-1" } },
		});
	});

	it("sets preview_accepted_at for requester", async () => {
		const updateChain = createQueryChain({ data: { id: "trade-1" }, error: null });
		const updateSpy = updateChain.update as ReturnType<typeof vi.fn>;

		let callCount = 0;
		mockFrom.mockImplementation((table: string) => {
			if (table === "trade_requests") {
				callCount++;
				if (callCount === 1) {
					return createQueryChain({
						data: {
							id: "trade-1",
							requester_id: "user-1",
							provider_id: "provider-1",
							status: "previewing",
							terms_accepted_at: "2026-03-29T00:00:00Z",
							terms_accepted_by_recipient_at: "2026-03-29T00:00:00Z",
							preview_accepted_at: null,
							preview_accepted_by_recipient_at: null,
						},
					});
				}
				return updateChain;
			}
			return createQueryChain({ data: null });
		});

		const result = await acceptPreview("trade-1");

		expect(result.success).toBe(true);
		expect(updateSpy).toHaveBeenCalledWith(
			expect.objectContaining({
				preview_accepted_at: expect.any(String),
			}),
		);
	});

	it("advances to transferring when all 4 timestamps set", async () => {
		const updateChain = createQueryChain({ data: { id: "trade-1" }, error: null });
		const updateSpy = updateChain.update as ReturnType<typeof vi.fn>;

		let callCount = 0;
		mockFrom.mockImplementation((table: string) => {
			if (table === "trade_requests") {
				callCount++;
				if (callCount === 1) {
					return createQueryChain({
						data: {
							id: "trade-1",
							requester_id: "user-1",
							provider_id: "provider-1",
							status: "previewing",
							terms_accepted_at: "2026-03-29T00:00:00Z",
							terms_accepted_by_recipient_at: "2026-03-29T00:00:00Z",
							preview_accepted_at: null, // requester is about to accept now
							preview_accepted_by_recipient_at: "2026-03-29T00:00:00Z", // provider already accepted
						},
					});
				}
				return updateChain;
			}
			return createQueryChain({ data: null });
		});

		const result = await acceptPreview("trade-1");

		expect(result.success).toBe(true);
		expect(result.bothAccepted).toBe(true);
		// Second update call should set status to transferring
		expect(updateSpy).toHaveBeenCalledWith(
			expect.objectContaining({
				status: "transferring",
			}),
		);
	});

	it("returns bothAccepted=false when other party has not accepted preview", async () => {
		const updateChain = createQueryChain({ data: { id: "trade-1" }, error: null });

		let callCount = 0;
		mockFrom.mockImplementation((table: string) => {
			if (table === "trade_requests") {
				callCount++;
				if (callCount === 1) {
					return createQueryChain({
						data: {
							id: "trade-1",
							requester_id: "user-1",
							provider_id: "provider-1",
							status: "previewing",
							terms_accepted_at: "2026-03-29T00:00:00Z",
							terms_accepted_by_recipient_at: "2026-03-29T00:00:00Z",
							preview_accepted_at: null,
							preview_accepted_by_recipient_at: null, // provider hasn't accepted yet
						},
					});
				}
				return updateChain;
			}
			return createQueryChain({ data: null });
		});

		const result = await acceptPreview("trade-1");

		expect(result.success).toBe(true);
		expect(result.bothAccepted).toBe(false);
	});

	it("rejects when trade not in previewing status", async () => {
		mockFrom.mockImplementation((table: string) => {
			if (table === "trade_requests") {
				return createQueryChain({
					data: {
						id: "trade-1",
						requester_id: "user-1",
						provider_id: "provider-1",
						status: "lobby",
						terms_accepted_at: null,
						terms_accepted_by_recipient_at: null,
						preview_accepted_at: null,
						preview_accepted_by_recipient_at: null,
					},
				});
			}
			return createQueryChain({ data: null });
		});

		const result = await acceptPreview("trade-1");

		expect(result.error).toBe("Trade is not in preview phase");
	});

	it("rejects non-participants", async () => {
		mockFrom.mockImplementation((table: string) => {
			if (table === "trade_requests") {
				return createQueryChain({
					data: {
						id: "trade-1",
						requester_id: "other-a",
						provider_id: "other-b",
						status: "previewing",
						terms_accepted_at: "2026-03-29T00:00:00Z",
						terms_accepted_by_recipient_at: "2026-03-29T00:00:00Z",
						preview_accepted_at: null,
						preview_accepted_by_recipient_at: null,
					},
				});
			}
			return createQueryChain({ data: null });
		});

		const result = await acceptPreview("trade-1");

		expect(result.error).toBe("Not a participant in this trade");
	});
});

// ===========================================================================
// completeTrade (D-10 fix: reject accepted status, allow previewing/transferring)
// ===========================================================================

describe("completeTrade (D-10 fix)", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		mockGetUser.mockResolvedValue({
			data: { user: { id: "user-1" } },
		});
	});

	it("rejects trades in accepted status", async () => {
		mockFrom.mockImplementation((table: string) => {
			if (table === "trade_requests") {
				return createQueryChain({
					data: {
						id: "trade-1",
						requester_id: "user-1",
						provider_id: "provider-1",
						status: "accepted",
					},
				});
			}
			return createQueryChain({ data: null });
		});

		const result = await completeTrade("trade-1", 4, "Good quality");

		expect(result.error).toBe("Trade is not in an active state");
	});

	it("accepts trades in previewing status", async () => {
		const updateChain = createQueryChain({ data: { id: "trade-1" }, error: null });

		let callCount = 0;
		mockFrom.mockImplementation((table: string) => {
			if (table === "trade_requests") {
				callCount++;
				if (callCount === 1) {
					return createQueryChain({
						data: {
							id: "trade-1",
							requester_id: "user-1",
							provider_id: "provider-1",
							status: "previewing",
						},
					});
				}
				return updateChain;
			}
			if (table === "trade_reviews") {
				return createQueryChain({ data: null, error: null });
			}
			if (table === "notifications") {
				return createQueryChain({ error: null });
			}
			return createQueryChain({ data: null });
		});

		const result = await completeTrade("trade-1", 4, "Good quality");

		expect(result.success).toBe(true);
	});

	it("accepts trades in transferring status", async () => {
		const updateChain = createQueryChain({ data: { id: "trade-1" }, error: null });

		let callCount = 0;
		mockFrom.mockImplementation((table: string) => {
			if (table === "trade_requests") {
				callCount++;
				if (callCount === 1) {
					return createQueryChain({
						data: {
							id: "trade-1",
							requester_id: "user-1",
							provider_id: "provider-1",
							status: "transferring",
						},
					});
				}
				return updateChain;
			}
			if (table === "trade_reviews") {
				return createQueryChain({ data: null, error: null });
			}
			if (table === "notifications") {
				return createQueryChain({ error: null });
			}
			return createQueryChain({ data: null });
		});

		const result = await completeTrade("trade-1", 4, "Good quality");

		expect(result.success).toBe(true);
	});

	it("rejects invalid quality rating", async () => {
		const result = await completeTrade("trade-1", 6, null);

		expect(result.error).toBe("Quality rating must be between 1 and 5");
	});
});

// ===========================================================================
// skipReview (D-10 fix)
// ===========================================================================

describe("skipReview (D-10 fix)", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		mockGetUser.mockResolvedValue({
			data: { user: { id: "user-1" } },
		});
	});

	it("rejects trades in accepted status", async () => {
		mockFrom.mockImplementation((table: string) => {
			if (table === "trade_requests") {
				return createQueryChain({
					data: {
						id: "trade-1",
						requester_id: "user-1",
						provider_id: "provider-1",
						status: "accepted",
					},
				});
			}
			return createQueryChain({ data: null });
		});

		const result = await skipReview("trade-1");

		expect(result.error).toBe("Trade is not in an active state");
	});

	it("accepts trades in previewing status", async () => {
		const updateChain = createQueryChain({ data: { id: "trade-1" }, error: null });

		let callCount = 0;
		mockFrom.mockImplementation((table: string) => {
			if (table === "trade_requests") {
				callCount++;
				if (callCount === 1) {
					return createQueryChain({
						data: {
							id: "trade-1",
							requester_id: "user-1",
							provider_id: "provider-1",
							status: "previewing",
						},
					});
				}
				return updateChain;
			}
			return createQueryChain({ data: null });
		});

		const result = await skipReview("trade-1");

		expect(result.success).toBe(true);
	});

	it("accepts trades in transferring status", async () => {
		const updateChain = createQueryChain({ data: { id: "trade-1" }, error: null });

		let callCount = 0;
		mockFrom.mockImplementation((table: string) => {
			if (table === "trade_requests") {
				callCount++;
				if (callCount === 1) {
					return createQueryChain({
						data: {
							id: "trade-1",
							requester_id: "user-1",
							provider_id: "provider-1",
							status: "transferring",
						},
					});
				}
				return updateChain;
			}
			return createQueryChain({ data: null });
		});

		const result = await skipReview("trade-1");

		expect(result.success).toBe(true);
	});

	it("rejects non-participants", async () => {
		mockFrom.mockImplementation((table: string) => {
			if (table === "trade_requests") {
				return createQueryChain({
					data: {
						id: "trade-1",
						requester_id: "other-a",
						provider_id: "other-b",
						status: "transferring",
					},
				});
			}
			return createQueryChain({ data: null });
		});

		const result = await skipReview("trade-1");

		expect(result.error).toBe("Not a participant in this trade");
	});
});
