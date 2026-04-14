import { describe, expect, it } from "vitest";
import {
	addToWantlistSchema,
	wantlistItemIdSchema,
	addFromYouTubeSchema,
} from "@/lib/validations/wantlist";

const UUID = "550e8400-e29b-41d4-a716-446655440000";

describe("addToWantlistSchema", () => {
	it("accepts positive discogsId", () => {
		expect(addToWantlistSchema.safeParse({ discogsId: 12345 }).success).toBe(true);
	});

	it("rejects zero discogsId", () => {
		expect(addToWantlistSchema.safeParse({ discogsId: 0 }).success).toBe(false);
	});

	it("rejects negative discogsId", () => {
		expect(addToWantlistSchema.safeParse({ discogsId: -1 }).success).toBe(false);
	});
});

describe("wantlistItemIdSchema", () => {
	it("accepts valid UUID", () => {
		expect(wantlistItemIdSchema.safeParse({ wantlistItemId: UUID }).success).toBe(true);
	});

	it("rejects non-UUID", () => {
		expect(wantlistItemIdSchema.safeParse({ wantlistItemId: "bad" }).success).toBe(false);
	});
});

describe("addFromYouTubeSchema", () => {
	it("accepts valid YouTube data", () => {
		const r = addFromYouTubeSchema.safeParse({
			videoId: "dQw4w9WgXcQ",
			title: "Never Gonna Give You Up",
			channelTitle: "Rick Astley",
			thumbnail: "https://i.ytimg.com/vi/dQw4w9WgXcQ/default.jpg",
		});
		expect(r.success).toBe(true);
	});

	it("rejects missing videoId", () => {
		expect(
			addFromYouTubeSchema.safeParse({
				title: "Test",
				channelTitle: "Test",
				thumbnail: "https://example.com/img.jpg",
			}).success,
		).toBe(false);
	});

	it("rejects invalid thumbnail URL", () => {
		expect(
			addFromYouTubeSchema.safeParse({
				videoId: "abc",
				title: "Test",
				channelTitle: "Test",
				thumbnail: "not-a-url",
			}).success,
		).toBe(false);
	});
});
