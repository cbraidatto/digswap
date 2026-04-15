import { describe, expect, it } from "vitest";
import {
	compareDesktopVersions,
	isDesktopVersionOutdated,
	MIN_DESKTOP_VERSION,
	TRADE_PROTOCOL_VERSION,
} from "@/lib/desktop/version";

describe("desktop version helpers", () => {
	it("compares semver triplets correctly", () => {
		expect(compareDesktopVersions("0.2.0", "0.2.0")).toBe(0);
		expect(compareDesktopVersions("0.2.1", "0.2.0")).toBeGreaterThan(0);
		expect(compareDesktopVersions("0.1.9", "0.2.0")).toBeLessThan(0);
	});

	it("marks outdated versions below the minimum", () => {
		expect(isDesktopVersionOutdated("0.1.9", MIN_DESKTOP_VERSION)).toBe(true);
		expect(isDesktopVersionOutdated("0.2.0", MIN_DESKTOP_VERSION)).toBe(false);
		expect(TRADE_PROTOCOL_VERSION).toBe(2);
	});
});
