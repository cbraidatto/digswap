"use server";

import { beforeEach, describe, expect, it, vi } from "vitest";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------
const USER_ID = "11111111-1111-4111-8111-111111111111";
const ITEM_ID = "22222222-2222-4222-8222-222222222222";

let mockAuthUser: { id: string; email?: string } | null = { id: USER_ID };

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------
vi.mock("@/lib/supabase/server", () => ({
	createClient: vi.fn(async () => ({
		auth: {
			getUser: vi.fn(async () => ({
				data: { user: mockAuthUser },
			})),
		},
	})),
}));

const mockUpdateResult = { data: { id: ITEM_ID }, error: null };
let mockMaybeSingleReturn: { data: unknown; error: unknown } = mockUpdateResult;

const mockMaybeSingle = vi.fn(() => mockMaybeSingleReturn);
const mockSelect = vi.fn(() => ({ maybeSingle: mockMaybeSingle }));
const mockEqChain = vi.fn(() => ({ select: mockSelect }));
const mockEqFirst = vi.fn(() => ({ eq: mockEqChain }));
const mockUpdate = vi.fn(() => ({ eq: mockEqFirst }));

vi.mock("@/lib/supabase/admin", () => ({
	createAdminClient: vi.fn(() => ({
		from: vi.fn(() => ({
			update: mockUpdate,
		})),
	})),
}));

vi.mock("@/lib/rate-limit", () => ({
	apiRateLimit: null,
	safeLimit: vi.fn(async () => ({ success: true })),
}));

vi.mock("@/lib/discogs/client", () => ({
	computeRarityScore: vi.fn(() => 1.0),
	createDiscogsClient: vi.fn(),
}));

vi.mock("@/lib/gamification/badge-awards", () => ({
	awardBadge: vi.fn(),
}));

vi.mock("@/lib/notifications/match", () => ({
	checkWantlistMatches: vi.fn(),
}));

vi.mock("@/lib/social/log-activity", () => ({
	logActivity: vi.fn(),
}));

// ---------------------------------------------------------------------------
// Import actions (after mocks are set up)
// ---------------------------------------------------------------------------
import { setVisibility, toggleOpenForTrade, updateQualityMetadata } from "@/actions/collection";

// ---------------------------------------------------------------------------
// Reset mocks between tests
// ---------------------------------------------------------------------------
beforeEach(() => {
	vi.clearAllMocks();
	mockAuthUser = { id: USER_ID };
	mockMaybeSingleReturn = { data: { id: ITEM_ID }, error: null };
});

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------
describe("setVisibility", () => {
	it("updates visibility to tradeable", async () => {
		const result = await setVisibility(ITEM_ID, "tradeable");
		expect(result).toEqual({ success: true });
		expect(mockUpdate).toHaveBeenCalledWith(expect.objectContaining({ visibility: "tradeable" }));
	});

	it("updates visibility to private", async () => {
		const result = await setVisibility(ITEM_ID, "private");
		expect(result).toEqual({ success: true });
		expect(mockUpdate).toHaveBeenCalledWith(expect.objectContaining({ visibility: "private" }));
	});

	it("updates visibility to not_trading", async () => {
		const result = await setVisibility(ITEM_ID, "not_trading");
		expect(result).toEqual({ success: true });
		expect(mockUpdate).toHaveBeenCalledWith(expect.objectContaining({ visibility: "not_trading" }));
	});

	it("rejects invalid visibility value", async () => {
		const result = await setVisibility(ITEM_ID, "invalid_value");
		expect(result.error).toContain("Invalid visibility");
	});

	it("returns error when not authenticated", async () => {
		mockAuthUser = null;
		const result = await setVisibility(ITEM_ID, "tradeable");
		expect(result.error).toBe("Not authenticated");
	});

	it("returns Not found when item not owned", async () => {
		mockMaybeSingleReturn = { data: null, error: null };
		const result = await setVisibility(ITEM_ID, "tradeable");
		expect(result.error).toBe("Not found");
	});

	it("rejects invalid UUID", async () => {
		const result = await setVisibility("not-a-uuid", "tradeable");
		expect(result.error).toBeDefined();
	});
});

describe("updateQualityMetadata", () => {
	it("sets all quality fields", async () => {
		const result = await updateQualityMetadata(ITEM_ID, {
			audioFormat: "FLAC",
			bitrate: 1411,
			sampleRate: 44100,
		});
		expect(result).toEqual({ success: true });
		expect(mockUpdate).toHaveBeenCalledWith(
			expect.objectContaining({
				audio_format: "FLAC",
				bitrate: 1411,
				sample_rate: 44100,
			}),
		);
	});

	it("clears fields with null values", async () => {
		const result = await updateQualityMetadata(ITEM_ID, {
			audioFormat: null,
			bitrate: null,
			sampleRate: null,
		});
		expect(result).toEqual({ success: true });
		expect(mockUpdate).toHaveBeenCalledWith(
			expect.objectContaining({
				audio_format: null,
				bitrate: null,
				sample_rate: null,
			}),
		);
	});

	it("rejects invalid bitrate", async () => {
		const result = await updateQualityMetadata(ITEM_ID, {
			bitrate: -100,
		});
		expect(result.error).toBeDefined();
	});

	it("rejects excessively high sample rate", async () => {
		const result = await updateQualityMetadata(ITEM_ID, {
			sampleRate: 999999,
		});
		expect(result.error).toBeDefined();
	});

	it("returns error when not authenticated", async () => {
		mockAuthUser = null;
		const result = await updateQualityMetadata(ITEM_ID, { audioFormat: "MP3" });
		expect(result.error).toBe("Not authenticated");
	});
});

describe("toggleOpenForTrade backward compat", () => {
	it("true delegates to tradeable visibility", async () => {
		const result = await toggleOpenForTrade(ITEM_ID, true);
		expect(result).toEqual({ success: true });
		expect(mockUpdate).toHaveBeenCalledWith(expect.objectContaining({ visibility: "tradeable" }));
	});

	it("false delegates to not_trading visibility", async () => {
		const result = await toggleOpenForTrade(ITEM_ID, false);
		expect(result).toEqual({ success: true });
		expect(mockUpdate).toHaveBeenCalledWith(expect.objectContaining({ visibility: "not_trading" }));
	});
});
