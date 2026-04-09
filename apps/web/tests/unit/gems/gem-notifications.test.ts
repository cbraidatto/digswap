import { describe, expect, it } from "vitest";
import { detectGemTierChanges, type GemTierChange } from "@/lib/gems/notifications";

describe("detectGemTierChanges", () => {
	it("returns empty array when both maps are empty", () => {
		const oldScores = new Map<string, { score: number; title: string; discogsId: number | null }>();
		const newScores = new Map<string, { score: number; title: string; discogsId: number | null }>();

		const changes = detectGemTierChanges(oldScores, newScores);
		expect(changes).toEqual([]);
	});

	it("detects upgrade from quartz to amethyst (0.1 -> 0.5)", () => {
		const oldScores = new Map([
			["release-1", { score: 0.1, title: "Test Album", discogsId: 12345 }],
		]);
		const newScores = new Map([
			["release-1", { score: 0.5, title: "Test Album", discogsId: 12345 }],
		]);

		const changes = detectGemTierChanges(oldScores, newScores);
		expect(changes).toHaveLength(1);
		expect(changes[0]).toEqual<GemTierChange>({
			releaseId: "release-1",
			releaseTitle: "Test Album",
			discogsId: 12345,
			oldTier: "quartz",
			newTier: "amethyst",
			oldWeight: 1,
			newWeight: 3,
		});
	});

	it("detects upgrade from sapphire to diamond (5.0 -> 7.0)", () => {
		const oldScores = new Map([
			["release-2", { score: 5.0, title: "Rare Vinyl", discogsId: 67890 }],
		]);
		const newScores = new Map([
			["release-2", { score: 7.0, title: "Rare Vinyl", discogsId: 67890 }],
		]);

		const changes = detectGemTierChanges(oldScores, newScores);
		expect(changes).toHaveLength(1);
		expect(changes[0].oldTier).toBe("sapphire");
		expect(changes[0].newTier).toBe("diamond");
		expect(changes[0].oldWeight).toBe(35);
		expect(changes[0].newWeight).toBe(100);
	});

	it("returns no change when tier stays the same (0.5 -> 0.4, both amethyst)", () => {
		const oldScores = new Map([["release-3", { score: 0.5, title: "Same Tier", discogsId: 111 }]]);
		const newScores = new Map([["release-3", { score: 0.4, title: "Same Tier", discogsId: 111 }]]);

		const changes = detectGemTierChanges(oldScores, newScores);
		expect(changes).toEqual([]);
	});

	it("detects downgrade from ruby to amethyst (1.5 -> 0.5)", () => {
		const oldScores = new Map([["release-4", { score: 1.5, title: "Downgraded", discogsId: 222 }]]);
		const newScores = new Map([["release-4", { score: 0.5, title: "Downgraded", discogsId: 222 }]]);

		const changes = detectGemTierChanges(oldScores, newScores);
		expect(changes).toHaveLength(1);
		expect(changes[0].oldTier).toBe("ruby");
		expect(changes[0].newTier).toBe("amethyst");
		expect(changes[0].oldWeight).toBe(20);
		expect(changes[0].newWeight).toBe(3);
	});

	it("returns empty array for first sync (new records not in oldScores)", () => {
		const oldScores = new Map<string, { score: number; title: string; discogsId: number | null }>();
		const newScores = new Map([
			["release-new-1", { score: 0.5, title: "New Record 1", discogsId: 333 }],
			["release-new-2", { score: 3.5, title: "New Record 2", discogsId: 444 }],
		]);

		const changes = detectGemTierChanges(oldScores, newScores);
		expect(changes).toEqual([]);
	});

	it("detects multiple changes across different records", () => {
		const oldScores = new Map([
			["r-1", { score: 0.1, title: "Album A", discogsId: 1 }],
			["r-2", { score: 5.0, title: "Album B", discogsId: 2 }],
			["r-3", { score: 0.5, title: "Album C (no change)", discogsId: 3 }],
		]);
		const newScores = new Map([
			["r-1", { score: 1.0, title: "Album A", discogsId: 1 }],
			["r-2", { score: 7.0, title: "Album B", discogsId: 2 }],
			["r-3", { score: 0.6, title: "Album C (no change)", discogsId: 3 }],
			["r-new", { score: 10.0, title: "New Album (skip)", discogsId: 4 }],
		]);

		const changes = detectGemTierChanges(oldScores, newScores);
		// r-1: quartz -> emerald, r-2: sapphire -> diamond, r-3: no change, r-new: skipped
		expect(changes).toHaveLength(2);

		const r1Change = changes.find((c) => c.releaseId === "r-1");
		expect(r1Change).toBeDefined();
		expect(r1Change!.oldTier).toBe("quartz");
		expect(r1Change!.newTier).toBe("emerald");

		const r2Change = changes.find((c) => c.releaseId === "r-2");
		expect(r2Change).toBeDefined();
		expect(r2Change!.oldTier).toBe("sapphire");
		expect(r2Change!.newTier).toBe("diamond");
	});
});
