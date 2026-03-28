import { describe, it } from "vitest";

describe("Open Redirect Prevention", () => {
	it.todo("should reject absolute URL in next parameter");
	it.todo("should reject protocol-relative URL (//evil.com) in next parameter");
	it.todo("should reject URL with :// in next parameter");
	it.todo("should accept valid relative path in next parameter");
	it.todo("should default to /onboarding when next is null");
});
