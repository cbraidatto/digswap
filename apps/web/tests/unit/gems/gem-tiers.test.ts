import { describe, it, expect } from "vitest";
import {
  GEM_TIERS,
  getGemTier,
  getGemWeight,
  getGemInfo,
  computeGemScore,
  type GemTier,
} from "@/lib/gems/constants";

describe("GEM_TIERS", () => {
  it("has exactly 6 entries", () => {
    expect(GEM_TIERS).toHaveLength(6);
  });

  it("tiers are ordered by weight ascending", () => {
    for (let i = 1; i < GEM_TIERS.length; i++) {
      expect(GEM_TIERS[i].weight).toBeGreaterThan(GEM_TIERS[i - 1].weight);
    }
  });

  it("each tier has key, name, maxRatio, weight, color", () => {
    for (const tier of GEM_TIERS) {
      expect(tier).toHaveProperty("key");
      expect(tier).toHaveProperty("name");
      expect(tier).toHaveProperty("maxRatio");
      expect(tier).toHaveProperty("weight");
      expect(tier).toHaveProperty("color");
    }
  });

  it("diamond has weight 100", () => {
    const diamond = GEM_TIERS.find((t) => t.key === "diamond");
    expect(diamond?.weight).toBe(100);
  });
});

describe("getGemTier", () => {
  it("returns null for null score", () => {
    expect(getGemTier(null)).toBeNull();
  });

  it("returns null for undefined score", () => {
    expect(getGemTier(undefined as unknown as number | null)).toBeNull();
  });

  it("returns 'quartz' for 0.1", () => {
    expect(getGemTier(0.1)).toBe("quartz");
  });

  it("returns 'quartz' for 0.29", () => {
    expect(getGemTier(0.29)).toBe("quartz");
  });

  it("returns 'amethyst' for 0.3", () => {
    expect(getGemTier(0.3)).toBe("amethyst");
  });

  it("returns 'amethyst' for 0.5", () => {
    expect(getGemTier(0.5)).toBe("amethyst");
  });

  it("returns 'emerald' for 0.8", () => {
    expect(getGemTier(0.8)).toBe("emerald");
  });

  it("returns 'emerald' for 1.4", () => {
    expect(getGemTier(1.4)).toBe("emerald");
  });

  it("returns 'ruby' for 1.5", () => {
    expect(getGemTier(1.5)).toBe("ruby");
  });

  it("returns 'ruby' for 2.9", () => {
    expect(getGemTier(2.9)).toBe("ruby");
  });

  it("returns 'sapphire' for 3.0", () => {
    expect(getGemTier(3.0)).toBe("sapphire");
  });

  it("returns 'sapphire' for 5.9", () => {
    expect(getGemTier(5.9)).toBe("sapphire");
  });

  it("returns 'diamond' for 6.0", () => {
    expect(getGemTier(6.0)).toBe("diamond");
  });

  it("returns 'diamond' for 7.0", () => {
    expect(getGemTier(7.0)).toBe("diamond");
  });

  it("returns 'diamond' for 100", () => {
    expect(getGemTier(100)).toBe("diamond");
  });
});

describe("getGemWeight", () => {
  it("returns 1 for quartz", () => {
    expect(getGemWeight("quartz")).toBe(1);
  });

  it("returns 3 for amethyst", () => {
    expect(getGemWeight("amethyst")).toBe(3);
  });

  it("returns 8 for emerald", () => {
    expect(getGemWeight("emerald")).toBe(8);
  });

  it("returns 20 for ruby", () => {
    expect(getGemWeight("ruby")).toBe(20);
  });

  it("returns 35 for sapphire", () => {
    expect(getGemWeight("sapphire")).toBe(35);
  });

  it("returns 100 for diamond", () => {
    expect(getGemWeight("diamond")).toBe(100);
  });
});

describe("getGemInfo", () => {
  it("returns full tier object for quartz", () => {
    const info = getGemInfo("quartz");
    expect(info.key).toBe("quartz");
    expect(info.name).toBe("Quartzo");
    expect(info.color).toBe("#9CA3AF");
  });

  it("returns full tier object for diamond", () => {
    const info = getGemInfo("diamond");
    expect(info.key).toBe("diamond");
    expect(info.name).toBe("Diamante");
    expect(info.color).toBe("#F0F9FF");
    expect(info.weight).toBe(100);
  });
});

describe("computeGemScore", () => {
  it("returns sum of gem weights for an array of scores", () => {
    // 0.1 -> quartz (1), 0.5 -> amethyst (3), 1.0 -> emerald (8),
    // 2.0 -> ruby (20), 4.0 -> sapphire (35), 7.0 -> diamond (100)
    const result = computeGemScore([0.1, 0.5, 1.0, 2.0, 4.0, 7.0]);
    expect(result).toBe(1 + 3 + 8 + 20 + 35 + 100);
  });

  it("returns 0 for empty array", () => {
    expect(computeGemScore([])).toBe(0);
  });

  it("handles all quartz scores", () => {
    expect(computeGemScore([0.1, 0.2, 0.05])).toBe(3);
  });

  it("handles all diamond scores", () => {
    expect(computeGemScore([6.0, 10.0, 100.0])).toBe(300);
  });
});
