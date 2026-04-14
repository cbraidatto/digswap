import { beforeEach, describe, expect, it, vi } from "vitest";

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------
const USER_ID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const SESSION_DB_ID = "sess-1111";

let mockAuthUser: { id: string } | null = { id: USER_ID };
let selectResults: unknown[][] = [];
let queryCallCount = 0;
const mockDeleteWhere = vi.fn();

vi.mock("@/lib/supabase/server", () => ({
	createClient: vi.fn(async () => ({
		auth: {
			getUser: vi.fn(async () => ({
				data: { user: mockAuthUser },
				error: mockAuthUser ? null : { message: "Not auth" },
			})),
			getClaims: vi.fn(async () => ({
				data: { claims: { session_id: "current-jwt-session" } },
			})),
		},
	})),
}));

vi.mock("@/lib/rate-limit", () => ({
	apiRateLimit: null,
	safeLimit: vi.fn(async () => ({ success: true })),
}));

vi.mock("@/lib/supabase/admin", () => ({
	createAdminClient: vi.fn(() => ({
		from: vi.fn(() => ({
			delete: vi.fn(() => ({
				eq: vi.fn(async () => ({ error: null })),
			})),
		})),
		auth: {
			admin: {
				signOut: vi.fn(async () => {}),
			},
		},
	})),
}));

vi.mock("next/headers", () => ({
	headers: vi.fn(async () => ({
		get: vi.fn((name: string) => {
			if (name === "user-agent") return "Chrome/120 Windows";
			if (name === "x-forwarded-for") return "1.2.3.4";
			return null;
		}),
	})),
}));

vi.mock("@/lib/db", () => {
	const chain: Record<string, unknown> = {};
	const methods = ["select", "from", "where", "orderBy", "limit", "innerJoin", "leftJoin"];
	for (const m of methods) {
		chain[m] = vi.fn().mockImplementation(() => chain);
	}
	chain.then = (resolve: (v: unknown) => void) => {
		const result = selectResults[queryCallCount] ?? [];
		queryCallCount++;
		return resolve(result);
	};

	const mockInsertValues = vi.fn();
	chain.insert = vi.fn().mockImplementation(() => ({
		values: mockInsertValues.mockImplementation(() => ({
			then: (resolve: (v: unknown) => void) => {
				queryCallCount++;
				return resolve([]);
			},
		})),
	}));

	chain.delete = vi.fn().mockImplementation(() => ({
		where: mockDeleteWhere.mockImplementation(() => ({
			then: (resolve: (v: unknown) => void) => {
				queryCallCount++;
				return resolve([]);
			},
		})),
	}));

	return { db: chain };
});

vi.mock("@/lib/db/schema/sessions", () => ({
	userSessions: {
		id: "id",
		userId: "user_id",
		sessionId: "session_id",
		deviceInfo: "device_info",
		ipAddress: "ip_address",
		createdAt: "created_at",
		lastSeenAt: "last_seen_at",
	},
}));

vi.mock("@/lib/validations/sessions", () => ({
	sessionIdSchema: {
		safeParse: vi.fn((data: unknown) => {
			const d = data as { sessionId?: string };
			if (d?.sessionId && d.sessionId.length > 0) {
				return { success: true, data: d };
			}
			return { success: false };
		}),
	},
	enforceSessionLimitSchema: {
		safeParse: vi.fn((data: unknown) => {
			const d = data as { userId?: string; newSessionId?: string };
			if (d?.userId && d?.newSessionId) {
				return { success: true, data: d };
			}
			return { success: false };
		}),
	},
	recordSessionSchema: {
		safeParse: vi.fn((data: unknown) => {
			const d = data as { userId?: string; sessionId?: string };
			if (d?.userId && d?.sessionId) {
				return { success: true, data: d };
			}
			return { success: false };
		}),
	},
}));

const { getSessions, terminateSession, enforceSessionLimit, recordSession } =
	await import("@/actions/sessions");

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

beforeEach(() => {
	mockAuthUser = { id: USER_ID };
	selectResults = [];
	queryCallCount = 0;
	vi.clearAllMocks();
});

describe("getSessions", () => {
	it("returns error when not authenticated", async () => {
		mockAuthUser = null;
		const result = await getSessions();
		expect(result.success).toBe(false);
		expect(result.error).toBe("Not authenticated");
	});

	it("returns sessions for authenticated user", async () => {
		const now = new Date();
		selectResults = [
			[
				{
					id: "s1",
					sessionId: "current-jwt-session",
					deviceInfo: "Chrome/120 Windows",
					ipAddress: "1.2.3.4",
					createdAt: now,
					lastSeenAt: now,
					userId: USER_ID,
				},
			],
		];

		const result = await getSessions();
		expect(result.success).toBe(true);
		expect(result.sessions).toHaveLength(1);
		expect(result.sessions[0].isCurrent).toBe(true);
		expect(result.sessions[0].deviceInfo).toContain("Chrome");
	});
});

describe("terminateSession", () => {
	it("returns error for empty session ID", async () => {
		const result = await terminateSession("");
		expect(result.success).toBe(false);
		expect(result.error).toBe("Invalid session ID");
	});

	it("returns error when not authenticated", async () => {
		mockAuthUser = null;
		const result = await terminateSession(SESSION_DB_ID);
		expect(result.success).toBe(false);
		expect(result.error).toBe("Not authenticated");
	});

	it("returns error when session not found (IDOR prevention)", async () => {
		selectResults = [[]];
		const result = await terminateSession(SESSION_DB_ID);
		expect(result.success).toBe(false);
		expect(result.error).toBe("Session not found");
	});

	it("terminates session successfully", async () => {
		selectResults = [
			[{ id: SESSION_DB_ID, userId: USER_ID, sessionId: "jwt-session-to-kill" }],
		];
		const result = await terminateSession(SESSION_DB_ID);
		expect(result.success).toBe(true);
	});
});

describe("enforceSessionLimit", () => {
	it("does nothing with invalid input", async () => {
		await enforceSessionLimit("", "");
		// Should return early, no error thrown
	});

	it("does nothing when user mismatch (security)", async () => {
		const otherUser = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
		await enforceSessionLimit(otherUser, "new-session");
		// Should return early since authenticated user !== otherUser
	});

	it("does not evict sessions when under limit", async () => {
		selectResults = [
			[
				{ id: "s1", userId: USER_ID, createdAt: new Date() },
				{ id: "s2", userId: USER_ID, createdAt: new Date() },
			],
		];
		await enforceSessionLimit(USER_ID, "new-session");
		expect(mockDeleteWhere).not.toHaveBeenCalled();
	});
});

describe("recordSession", () => {
	it("does nothing with invalid input", async () => {
		await recordSession("", "");
		// returns early
	});

	it("does nothing when user mismatch", async () => {
		const otherUser = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
		await recordSession(otherUser, "sess-123");
		// returns early
	});

	it("records session for authenticated matching user", async () => {
		// enforceSessionLimit sub-call also reads sessions
		selectResults = [
			// recordSession insert (consumed by .then)
			[],
			// enforceSessionLimit select
			[{ id: "s1", userId: USER_ID, createdAt: new Date() }],
		];
		await recordSession(USER_ID, "new-session-id");
		// Should not throw
	});
});
