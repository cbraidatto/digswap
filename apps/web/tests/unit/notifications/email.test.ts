import { describe, test, expect, vi, beforeEach } from "vitest";

// Use vi.hoisted to declare mocks that will be used inside vi.mock factories
const mockSend = vi.hoisted(() => vi.fn());

// Mock the resend module with a proper class constructor
vi.mock("resend", () => {
	return {
		Resend: class MockResend {
			emails = { send: mockSend };
		},
	};
});

import { sendWantlistMatchEmail } from "@/lib/notifications/email";

describe("sendWantlistMatchEmail", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		mockSend.mockResolvedValue({ data: { id: "email-123" }, error: null });
	});

	test("calls resend.emails.send with correct subject", async () => {
		await sendWantlistMatchEmail(
			"user@example.com",
			"Kind of Blue",
			"Miles Davis",
			"jazzhound",
		);

		expect(mockSend).toHaveBeenCalledTimes(1);
		const callArgs = mockSend.mock.calls[0][0];
		expect(callArgs.subject).toBe(
			"Someone has a record from your wantlist",
		);
		expect(callArgs.to).toBe("user@example.com");
	});

	test("does not throw on Resend error", async () => {
		mockSend.mockRejectedValue(new Error("API rate limited"));

		await expect(
			sendWantlistMatchEmail(
				"user@example.com",
				"Kind of Blue",
				"Miles Davis",
				"jazzhound",
			),
		).resolves.toBeUndefined();
	});

	test("email body contains record title, artist, and owner username", async () => {
		await sendWantlistMatchEmail(
			"user@example.com",
			"A Love Supreme",
			"John Coltrane",
			"crateking",
		);

		const callArgs = mockSend.mock.calls[0][0];
		expect(callArgs.html).toContain("A Love Supreme");
		expect(callArgs.html).toContain("John Coltrane");
		expect(callArgs.html).toContain("crateking");
	});
});
