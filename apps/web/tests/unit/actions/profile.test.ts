import { beforeEach, describe, expect, it, vi } from "vitest";

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------
const USER_ID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const RELEASE_ID = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";

let mockAuthUser: { id: string; email?: string } | null = { id: USER_ID };
let selectResults: unknown[][] = [];
let queryCallCount = 0;
const mockInsertValues = vi.fn();
const mockUpdateSet = vi.fn();
const mockUpdateWhere = vi.fn();

vi.mock("@/lib/rate-limit", () => ({
	apiRateLimit: null,
	safeLimit: vi.fn(async () => ({ success: true })),
}));

vi.mock("@/lib/supabase/server", () => ({
	createClient: vi.fn(async () => ({
		auth: {
			getUser: vi.fn(async () => ({
				data: { user: mockAuthUser },
			})),
		},
		storage: {
			from: vi.fn(() => ({
				upload: vi.fn(async () => ({ error: null })),
				getPublicUrl: vi.fn(() => ({
					data: { publicUrl: "https://storage.example.com/file.jpg" },
				})),
				list: vi.fn(async () => ({
					data: [{ name: "cover.jpg" }],
				})),
				remove: vi.fn(async () => ({ error: null })),
			})),
		},
	})),
}));

vi.mock("next/cache", () => ({
	revalidatePath: vi.fn(),
}));

vi.mock("@/lib/db", () => {
	const chain: Record<string, unknown> = {};

	const methods = [
		"select",
		"selectDistinctOn",
		"from",
		"where",
		"orderBy",
		"limit",
		"innerJoin",
		"leftJoin",
	];
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

	return { db: chain };
});

vi.mock("@/lib/db/schema/users", () => ({
	profiles: {
		id: "id",
		displayName: "display_name",
		username: "username",
		location: "location",
		bio: "bio",
		showcaseSearchingId: "showcase_searching_id",
		showcaseRarestId: "showcase_rarest_id",
		showcaseFavoriteId: "showcase_favorite_id",
		holyGrailIds: "holy_grail_ids",
		coverPositionY: "cover_position_y",
		coverUrl: "cover_url",
		avatarUrl: "avatar_url",
		updatedAt: "updated_at",
	},
}));

vi.mock("@/lib/db/schema/collections", () => ({
	collectionItems: {
		userId: "user_id",
		releaseId: "release_id",
	},
}));

vi.mock("@/lib/db/schema/releases", () => ({
	releases: {
		id: "id",
		title: "title",
		artist: "artist",
		year: "year",
		discogsId: "discogs_id",
		coverImageUrl: "cover_image_url",
	},
}));

vi.mock("@/lib/validations/common", () => ({
	sanitizeWildcards: vi.fn((s: string) => s),
	uuidSchema: {
		nullable: vi.fn().mockReturnValue({
			safeParse: vi.fn((v: unknown) => {
				if (v === null) return { success: true, data: null };
				const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
				if (typeof v === "string" && uuidRegex.test(v)) {
					return { success: true, data: v };
				}
				return { success: false, error: { issues: [{ message: "Invalid UUID" }] } };
			}),
		}),
	},
}));

const {
	updateShowcase,
	searchCollectionForShowcase,
	updateProfile,
	uploadCoverImage,
	uploadAvatar,
	updateHolyGrails,
	saveCoverPosition,
	removeCoverImage,
} = await import("@/actions/profile");

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function validProfileInput(overrides?: Record<string, unknown>) {
	return {
		displayName: "DJ Vinyl",
		username: "djvinyl",
		location: "Sao Paulo",
		bio: "Digging since 2005",
		...overrides,
	};
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

beforeEach(() => {
	mockAuthUser = { id: USER_ID };
	selectResults = [];
	queryCallCount = 0;
	vi.clearAllMocks();
});

// ---------------------------------------------------------------------------
// updateShowcase
// ---------------------------------------------------------------------------
describe("updateShowcase", () => {
	it("accepts valid slot and releaseId", async () => {
		const result = await updateShowcase("searching", RELEASE_ID);
		expect(result).toEqual({ ok: true });
	});

	it("accepts null releaseId to clear a slot", async () => {
		const result = await updateShowcase("favorite", null);
		expect(result).toEqual({ ok: true });
	});

	it("rejects an invalid slot name", async () => {
		const result = await updateShowcase("invalid" as never, RELEASE_ID);
		expect(result.error).toContain("Invalid showcase slot");
	});

	it("rejects a non-UUID releaseId", async () => {
		const result = await updateShowcase("rarest", "not-a-uuid");
		expect(result.error).toContain("Invalid release ID");
	});

	it("rejects unauthenticated caller", async () => {
		mockAuthUser = null;
		const result = await updateShowcase("searching", RELEASE_ID);
		expect(result.error).toBe("Unauthenticated");
	});
});

// ---------------------------------------------------------------------------
// searchCollectionForShowcase
// ---------------------------------------------------------------------------
describe("searchCollectionForShowcase", () => {
	it("returns empty array when not authenticated", async () => {
		mockAuthUser = null;
		const result = await searchCollectionForShowcase("test");
		expect(result).toEqual([]);
	});

	it("returns empty array for empty query", async () => {
		const result = await searchCollectionForShowcase("   ");
		expect(result).toEqual([]);
	});

	it("returns rows from collection search", async () => {
		const row = { id: RELEASE_ID, title: "Blue Train", artist: "Coltrane" };
		selectResults = [[row]];
		const result = await searchCollectionForShowcase("blue");
		expect(result).toEqual([row]);
	});
});

// ---------------------------------------------------------------------------
// updateProfile
// ---------------------------------------------------------------------------
describe("updateProfile", () => {
	it("accepts valid profile input", async () => {
		const result = await updateProfile(validProfileInput());
		expect(result).toEqual({ ok: true });
	});

	it("rejects unauthenticated caller", async () => {
		mockAuthUser = null;
		const result = await updateProfile(validProfileInput());
		expect(result.error).toBe("Unauthenticated");
	});

	it("rejects empty display name after trim", async () => {
		const result = await updateProfile(validProfileInput({ displayName: "   " }));
		expect(result.error).toContain("Display name is required");
	});

	it("truncates display name to 50 characters", async () => {
		const longName = "A".repeat(100);
		const result = await updateProfile(validProfileInput({ displayName: longName }));
		// Should still succeed -- it truncates, doesn't reject
		expect(result).toEqual({ ok: true });
	});

	it("rejects non-HTTPS social URL", async () => {
		const result = await updateProfile(
			validProfileInput({ instagramUrl: "http://instagram.com/user" }),
		);
		expect(result.error).toMatch(/https/i);
	});

	it("accepts valid HTTPS social URLs", async () => {
		const result = await updateProfile(
			validProfileInput({
				youtubeUrl: "https://youtube.com/channel/123",
				instagramUrl: "https://instagram.com/user",
			}),
		);
		expect(result).toEqual({ ok: true });
	});

	it("rejects username shorter than 3 characters", async () => {
		const result = await updateProfile(validProfileInput({ username: "ab" }));
		expect(result.error).toContain("at least 3 characters");
	});
});

// ---------------------------------------------------------------------------
// updateHolyGrails
// ---------------------------------------------------------------------------
describe("updateHolyGrails", () => {
	it("accepts up to 3 valid UUIDs", async () => {
		const ids = [
			"11111111-1111-4111-8111-111111111111",
			"22222222-2222-4222-8222-222222222222",
			"33333333-3333-4333-8333-333333333333",
		];
		const result = await updateHolyGrails(ids);
		expect(result).toEqual({ success: true });
	});

	it("accepts an empty array", async () => {
		const result = await updateHolyGrails([]);
		expect(result).toEqual({ success: true });
	});

	it("rejects more than 3 UUIDs", async () => {
		const ids = [
			"11111111-1111-4111-8111-111111111111",
			"22222222-2222-4222-8222-222222222222",
			"33333333-3333-4333-8333-333333333333",
			"44444444-4444-4444-8444-444444444444",
		];
		const result = await updateHolyGrails(ids);
		expect(result.error).toContain("Maximum 3");
	});

	it("rejects invalid UUID format", async () => {
		const result = await updateHolyGrails(["not-a-uuid"]);
		expect(result.error).toContain("Invalid release ID");
	});

	it("rejects unauthenticated caller", async () => {
		mockAuthUser = null;
		const result = await updateHolyGrails([]);
		expect(result.error).toBe("Not authenticated");
	});
});

// ---------------------------------------------------------------------------
// saveCoverPosition
// ---------------------------------------------------------------------------
describe("saveCoverPosition", () => {
	it("accepts a valid position value", async () => {
		const result = await saveCoverPosition(50);
		expect(result).toEqual({ ok: true });
	});

	it("clamps value above 100 to 100", async () => {
		const result = await saveCoverPosition(150);
		expect(result).toEqual({ ok: true });
		// The action clamps to [0,100] then writes -- verify set was called
		expect(mockUpdateSet).toHaveBeenCalled();
	});

	it("clamps negative value to 0", async () => {
		const result = await saveCoverPosition(-20);
		expect(result).toEqual({ ok: true });
		expect(mockUpdateSet).toHaveBeenCalled();
	});

	it("rejects NaN", async () => {
		const result = await saveCoverPosition(Number.NaN);
		expect(result.error).toContain("Invalid position");
	});

	it("rejects Infinity", async () => {
		const result = await saveCoverPosition(Number.POSITIVE_INFINITY);
		expect(result.error).toContain("Invalid position");
	});

	it("rejects unauthenticated caller", async () => {
		mockAuthUser = null;
		const result = await saveCoverPosition(50);
		expect(result.error).toBe("Unauthenticated");
	});
});

// ---------------------------------------------------------------------------
// removeCoverImage
// ---------------------------------------------------------------------------
describe("removeCoverImage", () => {
	it("removes cover for authenticated user", async () => {
		const result = await removeCoverImage();
		expect(result).toEqual({ ok: true });
	});

	it("rejects unauthenticated caller", async () => {
		mockAuthUser = null;
		const result = await removeCoverImage();
		expect(result.error).toBe("Unauthenticated");
	});
});

// ---------------------------------------------------------------------------
// uploadCoverImage
// ---------------------------------------------------------------------------
describe("uploadCoverImage", () => {
	it("rejects unauthenticated caller", async () => {
		mockAuthUser = null;
		const formData = new FormData();
		formData.append("cover", new File(["x"], "test.jpg", { type: "image/jpeg" }));
		const result = await uploadCoverImage(formData);
		expect(result.error).toBe("Unauthenticated");
	});

	it("rejects missing file", async () => {
		const formData = new FormData();
		const result = await uploadCoverImage(formData);
		expect(result.error).toContain("No file");
	});

	it("rejects file over 5MB", async () => {
		const bigContent = new Uint8Array(6 * 1024 * 1024);
		const formData = new FormData();
		formData.append("cover", new File([bigContent], "big.jpg", { type: "image/jpeg" }));
		const result = await uploadCoverImage(formData);
		expect(result.error).toContain("5MB");
	});
});

// ---------------------------------------------------------------------------
// uploadAvatar
// ---------------------------------------------------------------------------
describe("uploadAvatar", () => {
	it("rejects unauthenticated caller", async () => {
		mockAuthUser = null;
		const formData = new FormData();
		formData.append("avatar", new File(["x"], "test.jpg", { type: "image/jpeg" }));
		const result = await uploadAvatar(formData);
		expect(result.error).toBe("Unauthenticated");
	});

	it("rejects file over 2MB", async () => {
		const bigContent = new Uint8Array(3 * 1024 * 1024);
		const formData = new FormData();
		formData.append("avatar", new File([bigContent], "big.jpg", { type: "image/jpeg" }));
		const result = await uploadAvatar(formData);
		expect(result.error).toContain("2MB");
	});
});
