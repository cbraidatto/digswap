import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock the db module before importing queries
vi.mock("@/lib/db", () => {
  const executeMock = vi.fn();
  return {
    db: {
      execute: executeMock,
    },
  };
});

import { db } from "@/lib/db";
import { getGemDistribution, getGemScoreForUser } from "@/lib/gems/queries";

describe("getGemDistribution", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns all 6 tiers with 0 counts when collection is empty", async () => {
    // Mock db.execute to return empty result (no rows)
    (db.execute as ReturnType<typeof vi.fn>).mockResolvedValue([]);

    const result = await getGemDistribution("user-123");

    expect(result).toEqual({
      quartz: 0,
      amethyst: 0,
      emerald: 0,
      ruby: 0,
      sapphire: 0,
      diamond: 0,
    });
  });

  it("correctly maps query results to tier buckets", async () => {
    (db.execute as ReturnType<typeof vi.fn>).mockResolvedValue([
      { gem_tier: "quartz", count: "10" },
      { gem_tier: "amethyst", count: "5" },
      { gem_tier: "emerald", count: "3" },
      { gem_tier: "ruby", count: "2" },
      { gem_tier: "sapphire", count: "1" },
      { gem_tier: "diamond", count: "0" },
    ]);

    const result = await getGemDistribution("user-123");

    expect(result).toEqual({
      quartz: 10,
      amethyst: 5,
      emerald: 3,
      ruby: 2,
      sapphire: 1,
      diamond: 0,
    });
  });

  it("handles partial results (missing tiers default to 0)", async () => {
    (db.execute as ReturnType<typeof vi.fn>).mockResolvedValue([
      { gem_tier: "quartz", count: "50" },
      { gem_tier: "ruby", count: "7" },
    ]);

    const result = await getGemDistribution("user-123");

    expect(result).toEqual({
      quartz: 50,
      amethyst: 0,
      emerald: 0,
      ruby: 7,
      sapphire: 0,
      diamond: 0,
    });
  });

  it("calls db.execute with the user id", async () => {
    (db.execute as ReturnType<typeof vi.fn>).mockResolvedValue([]);

    await getGemDistribution("user-abc");

    expect(db.execute).toHaveBeenCalledTimes(1);
  });
});

describe("getGemScoreForUser", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 0 for user with no collection", async () => {
    (db.execute as ReturnType<typeof vi.fn>).mockResolvedValue([
      { gem_score: null },
    ]);

    const result = await getGemScoreForUser("user-empty");

    expect(result).toBe(0);
  });

  it("returns 0 when query returns empty array", async () => {
    (db.execute as ReturnType<typeof vi.fn>).mockResolvedValue([]);

    const result = await getGemScoreForUser("user-none");

    expect(result).toBe(0);
  });

  it("returns the gem score from the query result", async () => {
    (db.execute as ReturnType<typeof vi.fn>).mockResolvedValue([
      { gem_score: "167" },
    ]);

    const result = await getGemScoreForUser("user-with-gems");

    expect(result).toBe(167);
  });
});
