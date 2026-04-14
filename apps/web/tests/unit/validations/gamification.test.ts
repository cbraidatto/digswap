import { describe, expect, it } from "vitest";
import { leaderboardPageSchema, genreLeaderboardSchema } from "@/lib/validations/gamification";

describe("leaderboardPageSchema", () => {
	it("accepts valid page", () => {
		expect(leaderboardPageSchema.safeParse({ page: 5 }).success).toBe(true);
	});

	it("defaults page when omitted", () => {
		const r = leaderboardPageSchema.safeParse({});
		expect(r.success).toBe(true);
	});

	it("rejects page above 1000", () => {
		expect(leaderboardPageSchema.safeParse({ page: 1001 }).success).toBe(false);
	});

	it("rejects page 0", () => {
		expect(leaderboardPageSchema.safeParse({ page: 0 }).success).toBe(false);
	});
});

describe("genreLeaderboardSchema", () => {
	it("accepts genre + page", () => {
		expect(genreLeaderboardSchema.safeParse({ genre: "Jazz", page: 1 }).success).toBe(true);
	});

	it("requires genre", () => {
		expect(genreLeaderboardSchema.safeParse({ page: 1 }).success).toBe(false);
	});
});
