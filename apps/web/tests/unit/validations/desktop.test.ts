import { describe, expect, it } from "vitest";
import { handoffTokenSchema } from "@/lib/validations/desktop";

const UUID = "550e8400-e29b-41d4-a716-446655440000";

describe("handoffTokenSchema", () => {
	it("accepts valid tradeId UUID", () => {
		expect(handoffTokenSchema.safeParse({ tradeId: UUID }).success).toBe(true);
	});

	it("rejects non-UUID tradeId", () => {
		expect(handoffTokenSchema.safeParse({ tradeId: "bad" }).success).toBe(false);
	});

	it("rejects missing tradeId", () => {
		expect(handoffTokenSchema.safeParse({}).success).toBe(false);
	});
});
