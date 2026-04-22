import { describe, expect, it } from "vitest";
import {
	notificationIdSchema,
	notificationPageSchema,
	recentNotificationsSchema,
	updatePreferencesSchema,
} from "@/lib/validations/notifications";

const UUID = "550e8400-e29b-41d4-a716-446655440000";

describe("notificationPageSchema", () => {
	it("defaults page to 1", () => {
		const r = notificationPageSchema.safeParse({});
		expect(r.success).toBe(true);
		if (r.success) expect(r.data.page).toBe(1);
	});

	it("rejects page above 1000", () => {
		expect(notificationPageSchema.safeParse({ page: 1001 }).success).toBe(false);
	});
});

describe("recentNotificationsSchema", () => {
	it("defaults limit to 5", () => {
		const r = recentNotificationsSchema.safeParse({});
		expect(r.success).toBe(true);
		if (r.success) expect(r.data.limit).toBe(5);
	});

	it("rejects limit above 50", () => {
		expect(recentNotificationsSchema.safeParse({ limit: 51 }).success).toBe(false);
	});

	it("rejects limit below 1", () => {
		expect(recentNotificationsSchema.safeParse({ limit: 0 }).success).toBe(false);
	});
});

describe("notificationIdSchema", () => {
	it("accepts valid UUID", () => {
		expect(notificationIdSchema.safeParse({ notificationId: UUID }).success).toBe(true);
	});

	it("rejects non-UUID", () => {
		expect(notificationIdSchema.safeParse({ notificationId: "bad" }).success).toBe(false);
	});
});

describe("updatePreferencesSchema", () => {
	it("accepts empty object (all optional)", () => {
		expect(updatePreferencesSchema.safeParse({}).success).toBe(true);
	});

	it("accepts boolean preferences", () => {
		const r = updatePreferencesSchema.safeParse({
			wantlistMatchInapp: true,
			wantlistMatchEmail: false,
			tradeRequestInapp: true,
			pushEnabled: false,
		});
		expect(r.success).toBe(true);
	});

	it("rejects non-boolean values", () => {
		expect(updatePreferencesSchema.safeParse({ pushEnabled: "yes" }).success).toBe(false);
	});
});
