import { describe, expect, it } from "vitest";
import type { GemTierChange } from "@/lib/gems/notifications";
import { detectGemTierChanges } from "@/lib/gems/notifications";

// ---------------------------------------------------------------------------
// Tests — Pure function, no mocks needed
// ---------------------------------------------------------------------------

function makeEntry(score: number, title = "Test Record", discogsId: number | null = 12345) {
	return { score, title, discogsId };
}

describe("detectGemTierChanges", () => {
	it("detects tier upgrade from quartz to diamond", () => {
		const oldScores = new Map([["r1", makeEntry(0.1)]]);
		const newScores = new Map([["r1", makeEntry(10.0)]]);

		const changes = detectGemTierChanges(oldScores, newScores);
		expect(changes).toHaveLength(1);
		expect(changes[0].releaseId).toBe("r1");
		expect(changes[0].oldTier).toBe("quartz");
		expect(changes[0].newTier).toBe("diamond");
		expect(changes[0].oldWeight).toBe(1);
		expect(changes[0].newWeight).toBe(100);
	});

	it("detects tier downgrade from sapphire to emerald", () => {
		const oldScores = new Map([["r1", makeEntry(4.0)]]);
		const newScores = new Map([["r1", makeEntry(1.0)]]);

		const changes = detectGemTierChanges(oldScores, newScores);
		expect(changes).toHaveLength(1);
		expect(changes[0].oldTier).toBe("sapphire");
		expect(changes[0].newTier).toBe("emerald");
	});

	it("returns empty array when no tier changes", () => {
		const oldScores = new Map([["r1", makeEntry(0.1)]]);
		const newScores = new Map([["r1", makeEntry(0.2)]]);

		const changes = detectGemTierChanges(oldScores, newScores);
		expect(changes).toEqual([]);
	});

	it("skips new records not in oldScores (prevents first-sync flood)", () => {
		const oldScores = new Map<string, { score: number; title: string; discogsId: number | null }>();
		const newScores = new Map([
			["r1", makeEntry(0.1)],
			["r2", makeEntry(5.0)],
		]);

		const changes = detectGemTierChanges(oldScores, newScores);
		expect(changes).toEqual([]);
	});

	it("handles multiple changes across records", () => {
		const oldScores = new Map([
			["r1", makeEntry(0.1)], // quartz
			["r2", makeEntry(0.5)], // amethyst
			["r3", makeEntry(2.0)], // ruby
		]);
		const newScores = new Map([
			["r1", makeEntry(0.5)], // -> amethyst
			["r2", makeEntry(0.5)], // no change
			["r3", makeEntry(7.0)], // -> diamond
		]);

		const changes = detectGemTierChanges(oldScores, newScores);
		expect(changes).toHaveLength(2);

		const r1Change = changes.find((c) => c.releaseId === "r1");
		expect(r1Change?.oldTier).toBe("quartz");
		expect(r1Change?.newTier).toBe("amethyst");

		const r3Change = changes.find((c) => c.releaseId === "r3");
		expect(r3Change?.oldTier).toBe("ruby");
		expect(r3Change?.newTier).toBe("diamond");
	});

	it("includes releaseTitle and discogsId from newScores", () => {
		const oldScores = new Map([["r1", makeEntry(0.1, "Old Title", 111)]]);
		const newScores = new Map([["r1", makeEntry(5.0, "Updated Title", 222)]]);

		const changes = detectGemTierChanges(oldScores, newScores);
		expect(changes[0].releaseTitle).toBe("Updated Title");
		expect(changes[0].discogsId).toBe(222);
	});

	it("handles null discogsId", () => {
		const oldScores = new Map([["r1", makeEntry(0.1, "Title", null)]]);
		const newScores = new Map([["r1", makeEntry(5.0, "Title", null)]]);

		const changes = detectGemTierChanges(oldScores, newScores);
		expect(changes[0].discogsId).toBeNull();
	});

	it("returns empty array when both maps are empty", () => {
		const changes = detectGemTierChanges(new Map(), new Map());
		expect(changes).toEqual([]);
	});

	it("ignores records only in oldScores (removed records)", () => {
		const oldScores = new Map([["r1", makeEntry(0.1)]]);
		const newScores = new Map<string, { score: number; title: string; discogsId: number | null }>();

		const changes = detectGemTierChanges(oldScores, newScores);
		expect(changes).toEqual([]);
	});
});
