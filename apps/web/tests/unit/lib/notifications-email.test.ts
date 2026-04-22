import { beforeEach, describe, expect, it, vi } from "vitest";

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------
const mockSend = vi.fn().mockResolvedValue({ id: "email-001" });

vi.mock("resend", () => ({
	Resend: class {
		emails = { send: mockSend };
	},
}));

vi.mock("@/lib/env", () => ({
	env: {
		RESEND_API_KEY: "re_test_123",
		RESEND_FROM_EMAIL: "DigSwap <noreply@digswap.com>",
	},
	publicEnv: {
		NEXT_PUBLIC_APP_URL: "https://digswap.com",
	},
}));

const { sendWantlistMatchEmail } = await import("@/lib/notifications/email");

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

beforeEach(() => {
	mockSend.mockClear();
	mockSend.mockResolvedValue({ id: "email-001" });
});

describe("sendWantlistMatchEmail", () => {
	it("sends email with correct parameters", async () => {
		await sendWantlistMatchEmail("user@example.com", "Blue Train", "John Coltrane", "digger42");

		expect(mockSend).toHaveBeenCalledTimes(1);
		const call = mockSend.mock.calls[0][0];
		expect(call.to).toBe("user@example.com");
		expect(call.from).toBe("DigSwap <noreply@digswap.com>");
		expect(call.subject).toBe("Someone has a record from your wantlist");
		expect(call.html).toContain("Blue Train");
		expect(call.html).toContain("John Coltrane");
		expect(call.html).toContain("digger42");
	});

	it("escapes HTML in record title to prevent XSS", async () => {
		await sendWantlistMatchEmail(
			"user@example.com",
			'<script>alert("xss")</script>',
			"Artist",
			"user1",
		);

		expect(mockSend).toHaveBeenCalledTimes(1);
		const call = mockSend.mock.calls[0][0];
		expect(call.html).not.toContain("<script>");
		expect(call.html).toContain("&lt;script&gt;");
	});

	it("escapes HTML in artist name", async () => {
		await sendWantlistMatchEmail("user@example.com", "Title", 'Artist & "Friends"', "user1");

		expect(mockSend).toHaveBeenCalledTimes(1);
		const call = mockSend.mock.calls[0][0];
		expect(call.html).toContain("&amp;");
		expect(call.html).toContain("&quot;Friends&quot;");
	});

	it("escapes HTML in username", async () => {
		await sendWantlistMatchEmail("user@example.com", "Title", "Artist", "<b>evil</b>");

		expect(mockSend).toHaveBeenCalledTimes(1);
		const call = mockSend.mock.calls[0][0];
		expect(call.html).toContain("&lt;b&gt;evil&lt;/b&gt;");
	});

	it("includes profile link in email body", async () => {
		await sendWantlistMatchEmail("user@example.com", "Title", "Artist", "digger42");

		expect(mockSend).toHaveBeenCalledTimes(1);
		const call = mockSend.mock.calls[0][0];
		expect(call.html).toContain("https://digswap.com/perfil/digger42");
	});

	it("does not throw on send failure (non-fatal)", async () => {
		mockSend.mockRejectedValue(new Error("Resend API error"));

		await expect(
			sendWantlistMatchEmail("user@example.com", "Title", "Artist", "user1"),
		).resolves.toBeUndefined();
	});
});
