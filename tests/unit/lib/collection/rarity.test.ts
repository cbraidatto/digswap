import { describe, test } from "vitest";

describe("getRarityTier", () => {
	test.todo("returns 'Ultra Rare' for score >= 2.0");
	test.todo("returns 'Rare' for score >= 0.5 and < 2.0");
	test.todo("returns 'Common' for score < 0.5");
	test.todo("returns null for null score");
	test.todo("returns null for undefined score");
});

describe("getRarityBadgeVariant", () => {
	test.todo("returns 'destructive' for Ultra Rare");
	test.todo("returns 'default' for Rare");
	test.todo("returns 'secondary' for Common");
	test.todo("returns 'outline' for null");
});
