import { describe, expect, it } from "vitest";
import { extractSessionId } from "@/lib/auth/session-utils";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Build a fake JWT with the given payload object */
function fakeJwt(payload: Record<string, unknown>): string {
	const header = Buffer.from(JSON.stringify({ alg: "HS256" })).toString("base64url");
	const body = Buffer.from(JSON.stringify(payload)).toString("base64url");
	return `${header}.${body}.fakesig`;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("extractSessionId", () => {
	it("extracts session_id from a valid JWT", () => {
		const token = fakeJwt({ session_id: "sess-abc-123", sub: "user-1" });
		expect(extractSessionId(token)).toBe("sess-abc-123");
	});

	it("returns null when session_id claim is missing", () => {
		const token = fakeJwt({ sub: "user-1" });
		expect(extractSessionId(token)).toBeNull();
	});

	it("returns null for an empty string", () => {
		expect(extractSessionId("")).toBeNull();
	});

	it("returns null for a malformed token (no dots)", () => {
		expect(extractSessionId("not-a-jwt")).toBeNull();
	});

	it("returns null for a token with invalid base64 payload", () => {
		expect(extractSessionId("header.!!!invalid!!!.sig")).toBeNull();
	});

	it("returns null when payload is not valid JSON", () => {
		const badPayload = Buffer.from("not json").toString("base64url");
		expect(extractSessionId(`header.${badPayload}.sig`)).toBeNull();
	});

	it("handles a token with only header segment", () => {
		expect(extractSessionId("headeronly")).toBeNull();
	});

	it("handles UUID session_id values", () => {
		const uuid = "aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee";
		const token = fakeJwt({ session_id: uuid });
		expect(extractSessionId(token)).toBe(uuid);
	});
});
