import { describe, expect, it } from "vitest";
import {
	sessionIdSchema,
	enforceSessionLimitSchema,
	recordSessionSchema,
} from "@/lib/validations/sessions";

const UUID = "550e8400-e29b-41d4-a716-446655440000";

describe("sessionIdSchema", () => {
	it("accepts valid session id", () => {
		expect(sessionIdSchema.safeParse({ sessionId: "session-abc-123" }).success).toBe(true);
	});

	it("rejects empty sessionId", () => {
		expect(sessionIdSchema.safeParse({ sessionId: "" }).success).toBe(false);
	});

	it("rejects sessionId over 255 chars", () => {
		expect(sessionIdSchema.safeParse({ sessionId: "a".repeat(256) }).success).toBe(false);
	});
});

describe("enforceSessionLimitSchema", () => {
	it("accepts valid userId + newSessionId", () => {
		const r = enforceSessionLimitSchema.safeParse({
			userId: UUID,
			newSessionId: "new-session-id",
		});
		expect(r.success).toBe(true);
	});

	it("rejects non-UUID userId", () => {
		expect(
			enforceSessionLimitSchema.safeParse({ userId: "bad", newSessionId: "abc" }).success,
		).toBe(false);
	});
});

describe("recordSessionSchema", () => {
	it("accepts valid userId + sessionId", () => {
		const r = recordSessionSchema.safeParse({
			userId: UUID,
			sessionId: "session-123",
		});
		expect(r.success).toBe(true);
	});

	it("rejects empty sessionId", () => {
		expect(
			recordSessionSchema.safeParse({ userId: UUID, sessionId: "" }).success,
		).toBe(false);
	});
});
