import { describe, it } from "vitest";

describe("Content Security Policy", () => {
	it.todo("should include nonce in script-src");
	it.todo("should include nonce in style-src");
	it.todo("should not include unsafe-inline in production");
	it.todo("should not include unsafe-eval in production");
	it.todo("should set frame-ancestors to none");
	it.todo("should allow supabase and peerjs in connect-src");
	it.todo("should set form-action to self");
});
