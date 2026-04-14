import { beforeEach, describe, expect, it, vi } from "vitest";

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------
const GROUP_ID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const USER_ADMIN = "admin-1111-1111-1111-111111111111";
const USER_MEMBER = "member-2222-2222-2222-222222222222";
const INVITE_TOKEN = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";

let mockAuthUser: { id: string; email?: string } | null = { id: USER_ADMIN };
let selectResults: unknown[][] = [];
let queryCallCount = 0;
const mockInsertValues = vi.fn();
const mockUpdateSet = vi.fn();
const mockUpdateWhere = vi.fn();
const mockDeleteWhere = vi.fn();
const mockTransaction = vi.fn();

vi.mock("@/lib/auth/require-user", () => ({
	requireUser: vi.fn(async () => {
		if (!mockAuthUser) throw new Error("Not authenticated");
		return mockAuthUser;
	}),
}));

vi.mock("@/lib/rate-limit", () => ({
	apiRateLimit: null,
	safeLimit: vi.fn(async () => ({ success: true })),
}));

vi.mock("@/lib/social/log-activity", () => ({
	logActivity: vi.fn(async () => {}),
}));

vi.mock("@/lib/gamification/badge-awards", () => ({
	awardBadge: vi.fn(async () => {}),
}));

vi.mock("@/lib/supabase/admin", () => ({
	createAdminClient: vi.fn(() => ({
		from: vi.fn(() => ({
			insert: vi.fn(),
			select: vi.fn(() => ({
				eq: vi.fn(() => ({
					eq: vi.fn(() => ({
						gte: vi.fn(() => ({
							contains: vi.fn(() => ({
								limit: vi.fn(() => ({
									maybeSingle: vi.fn(async () => ({ data: null })),
								})),
							})),
						})),
					})),
				})),
			})),
		})),
	})),
}));

vi.mock("@/lib/community/queries", () => ({
	getGenreGroups: vi.fn(async () => []),
	getGroupPosts: vi.fn(async () => []),
	getMemberGroups: vi.fn(async () => []),
	getReviewCountForRelease: vi.fn(async () => 0),
	getReviewsForRelease: vi.fn(async () => []),
}));

vi.mock("@/lib/community/slugify", () => ({
	slugify: vi.fn((name: string) => name.toLowerCase().replace(/\s+/g, "-")),
}));

vi.mock("@/lib/validations/community", async () => {
	const { z } = await import("zod");

	return {
		createGroupSchema: z.object({
			name: z.string().min(1, "Group name is required.").max(80).trim(),
			description: z.string().max(500).trim().optional(),
			category: z.string().max(100).trim().optional(),
			visibility: z.enum(["public", "private"]).default("public"),
		}),
		createPostSchema: z.object({
			groupId: z.string().uuid(),
			content: z.string().min(1, "Post content is required").max(5000).trim(),
			releaseId: z.string().uuid().optional(),
		}),
		createReviewSchema: z.object({
			releaseId: z.string().uuid(),
			rating: z.number().int().min(1).max(5),
			title: z.string().min(1).max(200).trim().optional(),
			body: z.string().min(1, "Review body is required").max(5000).trim(),
			pressingDetails: z.string().max(2000).trim().optional(),
			groupId: z.string().uuid().optional(),
		}),
	};
});

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

	chain.insert = vi.fn().mockImplementation(() => ({
		values: mockInsertValues.mockImplementation(() => ({
			returning: vi.fn().mockImplementation(() => ({
				then: (resolve: (v: unknown) => void) => {
					const result = selectResults[queryCallCount] ?? [];
					queryCallCount++;
					return resolve(result);
				},
			})),
			onConflictDoUpdate: vi.fn().mockImplementation(() => ({
				returning: vi.fn().mockImplementation(() => ({
					then: (resolve: (v: unknown) => void) => {
						const result = selectResults[queryCallCount] ?? [];
						queryCallCount++;
						return resolve(result);
					},
				})),
				then: (resolve: (v: unknown) => void) => {
					const result = selectResults[queryCallCount] ?? [];
					queryCallCount++;
					return resolve(result);
				},
			})),
			then: (resolve: (v: unknown) => void) => {
				const result = selectResults[queryCallCount] ?? [];
				queryCallCount++;
				return resolve(result);
			},
		})),
	}));

	chain.update = vi.fn().mockImplementation(() => ({
		set: mockUpdateSet.mockImplementation(() => ({
			where: mockUpdateWhere.mockImplementation(() => ({
				then: (resolve: (v: unknown) => void) => {
					const result = selectResults[queryCallCount] ?? [];
					queryCallCount++;
					return resolve(result);
				},
			})),
		})),
	}));

	chain.delete = vi.fn().mockImplementation(() => ({
		where: mockDeleteWhere.mockImplementation(() => ({
			then: (resolve: (v: unknown) => void) => {
				const result = selectResults[queryCallCount] ?? [];
				queryCallCount++;
				return resolve(result);
			},
		})),
	}));

	chain.transaction = vi.fn().mockImplementation(async (fn: (tx: unknown) => Promise<void>) => {
		mockTransaction();
		// Execute the transaction callback with a mock tx that behaves like chain
		const txChain: Record<string, unknown> = {};
		for (const m of methods) {
			txChain[m] = vi.fn().mockImplementation(() => txChain);
		}
		txChain.insert = vi.fn().mockImplementation(() => ({
			values: vi.fn().mockImplementation(() => ({
				then: (resolve: (v: unknown) => void) => resolve(undefined),
			})),
		}));
		txChain.update = vi.fn().mockImplementation(() => ({
			set: vi.fn().mockImplementation(() => ({
				where: vi.fn().mockImplementation(() => ({
					then: (resolve: (v: unknown) => void) => resolve(undefined),
				})),
			})),
		}));
		txChain.delete = vi.fn().mockImplementation(() => ({
			where: vi.fn().mockImplementation(() => ({
				then: (resolve: (v: unknown) => void) => resolve(undefined),
			})),
		}));
		await fn(txChain);
	});

	return { db: chain };
});

vi.mock("@/lib/db/schema/groups", () => ({
	groups: {
		id: "id",
		creatorId: "creator_id",
		name: "name",
		slug: "slug",
		description: "description",
		category: "category",
		visibility: "visibility",
		memberCount: "member_count",
	},
	groupMembers: {
		id: "id",
		groupId: "group_id",
		userId: "user_id",
		role: "role",
	},
	groupPosts: {
		id: "id",
		groupId: "group_id",
		userId: "user_id",
		content: "content",
		releaseId: "release_id",
		reviewId: "review_id",
	},
}));

vi.mock("@/lib/db/schema/group-invites", () => ({
	groupInvites: {
		id: "id",
		groupId: "group_id",
		token: "token",
		createdBy: "created_by",
		expiresAt: "expires_at",
	},
}));

vi.mock("@/lib/db/schema/reviews", () => ({
	reviews: {
		id: "id",
		userId: "user_id",
		releaseId: "release_id",
		rating: "rating",
		title: "title",
		body: "body",
		isPressingSpecific: "is_pressing_specific",
		pressingDetails: "pressing_details",
		updatedAt: "updated_at",
	},
}));

vi.mock("@/lib/db/schema/users", () => ({
	profiles: {
		id: "id",
		username: "username",
	},
}));

const {
	createGroupAction,
	joinGroupAction,
	leaveGroupAction,
	createPostAction,
	generateInviteAction,
	acceptInviteAction,
} = await import("@/actions/community");

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
beforeEach(() => {
	mockAuthUser = { id: USER_ADMIN };
	selectResults = [];
	queryCallCount = 0;
	mockTransaction.mockClear();
	vi.clearAllMocks();
});

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("createGroupAction", () => {
	it("creates a group and returns slug", async () => {
		// Query 1: slug uniqueness check (no conflict)
		// Query 2: insert returning
		selectResults = [
			[], // slug check — no existing group
			[{ id: GROUP_ID, slug: "jazz-heads" }], // insert returning
		];

		const result = await createGroupAction({
			name: "Jazz Heads",
			visibility: "public",
		});

		expect(result).toHaveProperty("slug");
		expect((result as { slug: string }).slug).toBe("jazz-heads");
	});

	it("rejects empty group name", async () => {
		const result = await createGroupAction({
			name: "",
			visibility: "public",
		});

		expect(result).toHaveProperty("error");
		expect((result as { error: string }).error).toContain("Group name is required");
	});

	it("rejects unauthenticated caller", async () => {
		mockAuthUser = null;

		const result = await createGroupAction({
			name: "Test Group",
			visibility: "public",
		});

		expect(result).toHaveProperty("error");
	});
});

describe("joinGroupAction", () => {
	it("allows joining a public group", async () => {
		mockAuthUser = { id: USER_MEMBER };
		selectResults = [
			// Query 1: group lookup
			[{ id: GROUP_ID, name: "Jazz Heads", slug: "jazz-heads", visibility: "public" }],
			// Query 2: existing member check (not a member)
			[],
		];

		const result = await joinGroupAction(GROUP_ID);

		expect(result).toHaveProperty("success", true);
	});

	it("rejects joining a private group without invite", async () => {
		mockAuthUser = { id: USER_MEMBER };
		selectResults = [
			// Query 1: group lookup — private
			[{ id: GROUP_ID, name: "Secret Vinyl Club", slug: "secret-vinyl-club", visibility: "private" }],
			// Query 2: existing member check
			[],
		];

		const result = await joinGroupAction(GROUP_ID);

		expect(result).toHaveProperty("error");
		expect((result as { error: string }).error).toContain("private");
		expect((result as { error: string }).error).toContain("invite");
	});

	it("rejects if already a member", async () => {
		mockAuthUser = { id: USER_MEMBER };
		selectResults = [
			// Query 1: group lookup
			[{ id: GROUP_ID, name: "Jazz Heads", slug: "jazz-heads", visibility: "public" }],
			// Query 2: existing member check — already a member
			[{ id: "existing-membership-id" }],
		];

		const result = await joinGroupAction(GROUP_ID);

		expect(result).toHaveProperty("error");
		expect((result as { error: string }).error).toContain("Already a member");
	});

	it("rejects unauthenticated caller", async () => {
		mockAuthUser = null;

		const result = await joinGroupAction(GROUP_ID);

		expect(result).toHaveProperty("error");
	});
});

describe("leaveGroupAction", () => {
	it("allows a regular member to leave", async () => {
		mockAuthUser = { id: USER_MEMBER };
		selectResults = [
			// Query 1: membership check
			[{ id: "membership-id", role: "member" }],
		];

		const result = await leaveGroupAction(GROUP_ID);

		expect(result).toHaveProperty("success", true);
	});

	it("rejects sole admin from leaving", async () => {
		selectResults = [
			// Query 1: membership check — admin
			[{ id: "membership-id", role: "admin" }],
			// Query 2: other admins check — only this admin
			[{ id: "membership-id" }],
		];

		const result = await leaveGroupAction(GROUP_ID);

		expect(result).toHaveProperty("error");
		expect((result as { error: string }).error).toContain("sole admin");
	});

	it("allows admin to leave when another admin exists", async () => {
		selectResults = [
			// Query 1: membership check — admin
			[{ id: "membership-id", role: "admin" }],
			// Query 2: other admins check — two admins exist
			[{ id: "membership-id" }, { id: "other-admin-id" }],
		];

		const result = await leaveGroupAction(GROUP_ID);

		expect(result).toHaveProperty("success", true);
	});

	it("rejects non-member", async () => {
		selectResults = [
			// Query 1: membership check — not found
			[],
		];

		const result = await leaveGroupAction(GROUP_ID);

		expect(result).toHaveProperty("error");
		expect((result as { error: string }).error).toContain("Not a member");
	});

	it("rejects unauthenticated caller", async () => {
		mockAuthUser = null;

		const result = await leaveGroupAction(GROUP_ID);

		expect(result).toHaveProperty("error");
	});
});

describe("createPostAction", () => {
	it("allows a member to create a post", async () => {
		selectResults = [
			// Query 1: membership check
			[{ id: "membership-id" }],
			// Query 2: group info
			[{ name: "Jazz Heads", slug: "jazz-heads" }],
			// Query 3: insert returning
			[{ id: "new-post-id" }],
		];

		const result = await createPostAction({
			groupId: GROUP_ID,
			content: "Check out this pressing!",
		});

		expect(result).toHaveProperty("id", "new-post-id");
	});

	it("rejects post from non-member", async () => {
		mockAuthUser = { id: USER_MEMBER };
		selectResults = [
			// Query 1: membership check — not found
			[],
		];

		const result = await createPostAction({
			groupId: GROUP_ID,
			content: "Trying to post without being a member",
		});

		expect(result).toHaveProperty("error");
		expect((result as { error: string }).error).toContain("must be a member");
	});

	it("rejects empty content", async () => {
		const result = await createPostAction({
			groupId: GROUP_ID,
			content: "",
		});

		expect(result).toHaveProperty("error");
	});

	it("rejects unauthenticated caller", async () => {
		mockAuthUser = null;

		const result = await createPostAction({
			groupId: GROUP_ID,
			content: "Hello!",
		});

		expect(result).toHaveProperty("error");
	});
});

describe("generateInviteAction", () => {
	it("allows admin to generate invite token", async () => {
		selectResults = [
			// Query 1: membership check — admin
			[{ role: "admin" }],
		];

		const result = await generateInviteAction(GROUP_ID);

		expect(result).toHaveProperty("token");
		expect(typeof (result as { token: string }).token).toBe("string");
	});

	it("rejects non-admin member", async () => {
		mockAuthUser = { id: USER_MEMBER };
		selectResults = [
			// Query 1: membership check — regular member
			[{ role: "member" }],
		];

		const result = await generateInviteAction(GROUP_ID);

		expect(result).toHaveProperty("error");
		expect((result as { error: string }).error).toContain("admin");
	});

	it("rejects non-member", async () => {
		mockAuthUser = { id: USER_MEMBER };
		selectResults = [
			// Query 1: membership check — not found
			[],
		];

		const result = await generateInviteAction(GROUP_ID);

		expect(result).toHaveProperty("error");
		expect((result as { error: string }).error).toContain("admin");
	});

	it("rejects unauthenticated caller", async () => {
		mockAuthUser = null;

		const result = await generateInviteAction(GROUP_ID);

		expect(result).toHaveProperty("error");
	});
});

describe("acceptInviteAction", () => {
	it("accepts a valid invite and returns group slug", async () => {
		const futureDate = new Date(Date.now() + 86400000); // 1 day from now
		selectResults = [
			// Query 1: invite lookup
			[{ groupId: GROUP_ID, expiresAt: futureDate.toISOString() }],
			// Query 2: existing member check — not a member
			[],
			// Query 3: get group slug after transaction
			[{ slug: "jazz-heads" }],
		];

		const result = await acceptInviteAction(INVITE_TOKEN);

		expect(result).toHaveProperty("slug", "jazz-heads");
	});

	it("rejects expired invite", async () => {
		const pastDate = new Date(Date.now() - 86400000); // 1 day ago
		selectResults = [
			// Query 1: invite lookup — expired
			[{ groupId: GROUP_ID, expiresAt: pastDate.toISOString() }],
		];

		const result = await acceptInviteAction(INVITE_TOKEN);

		expect(result).toHaveProperty("error");
		expect((result as { error: string }).error).toContain("expired");
	});

	it("rejects invalid token", async () => {
		selectResults = [
			// Query 1: invite lookup — not found
			[],
		];

		const result = await acceptInviteAction(INVITE_TOKEN);

		expect(result).toHaveProperty("error");
		expect((result as { error: string }).error).toContain("not found");
	});

	it("returns slug if already a member", async () => {
		const futureDate = new Date(Date.now() + 86400000);
		selectResults = [
			// Query 1: invite lookup
			[{ groupId: GROUP_ID, expiresAt: futureDate.toISOString() }],
			// Query 2: existing member check — already a member
			[{ id: "existing-membership" }],
			// Query 3: get group slug
			[{ slug: "jazz-heads" }],
		];

		const result = await acceptInviteAction(INVITE_TOKEN);

		expect(result).toHaveProperty("slug", "jazz-heads");
	});

	it("rejects unauthenticated caller", async () => {
		mockAuthUser = null;

		const result = await acceptInviteAction(INVITE_TOKEN);

		expect(result).toHaveProperty("error");
	});
});
