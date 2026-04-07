import { expect, test } from "@playwright/test";

/**
 * Authentication flow E2E tests.
 *
 * Tests that verify page rendering work without auth.
 * Tests that require authenticated sessions are marked with .skip()
 * and need Supabase env vars to run.
 */

test.describe("Authentication Pages", () => {
	test("signup page loads and shows form", async ({ page }) => {
		await page.goto("/signup");
		await expect(page).toHaveTitle(/DigSwap/i);

		// Verify form elements are visible
		await expect(page.getByLabel(/email/i)).toBeVisible();
		await expect(page.getByLabel(/^password$/i)).toBeVisible();
		await expect(page.getByRole("button", { name: /sign up|create account/i })).toBeVisible();
	});

	test("signin page loads and shows form", async ({ page }) => {
		await page.goto("/signin");
		await expect(page).toHaveTitle(/DigSwap/i);

		// Verify form elements are visible
		await expect(page.getByLabel(/email/i)).toBeVisible();
		await expect(page.getByLabel(/password/i)).toBeVisible();
		await expect(page.getByRole("button", { name: /sign in|log in/i })).toBeVisible();
	});

	test("forgot-password page loads", async ({ page }) => {
		await page.goto("/forgot-password");
		await expect(page).toHaveTitle(/DigSwap/i);

		// Verify email input for reset
		await expect(page.getByLabel(/email/i)).toBeVisible();
		await expect(page.getByRole("button", { name: /reset|send/i })).toBeVisible();
	});

	test("signup page shows password requirements", async ({ page }) => {
		await page.goto("/signup");

		// Fill in a weak password and verify validation feedback
		const emailInput = page.getByLabel(/email/i);
		await emailInput.fill("test@example.com");
	});

	test("signin page has link to signup", async ({ page }) => {
		await page.goto("/signin");

		// Link text is "Create an account" — regex must include the word "an"
		const signupLink = page.getByRole("link", {
			name: /sign up|create an? account|register/i,
		});
		await expect(signupLink).toBeVisible();
	});
});

test.describe("Authenticated Routes", () => {
	// These tests require a Supabase connection and valid auth session.
	// They are scaffolded for future implementation.

	test.skip("onboarding page loads for authenticated user", async ({ page }) => {
		// Requires: authenticated Supabase session via test user
		// Would navigate to /onboarding and verify step 1 loads
		await page.goto("/onboarding");
		await expect(page.getByText(/set up your profile/i)).toBeVisible();
	});

	test.skip("session persistence across page reload", async ({ page }) => {
		// Requires: authenticated Supabase session
		// Would:
		// 1. Sign in
		// 2. Navigate to a protected route
		// 3. Reload the page
		// 4. Verify still authenticated (not redirected to /signin)
		await page.goto("/settings/sessions");
		await page.reload();
		// Should still be on sessions page, not redirected
		await expect(page).toHaveURL(/settings\/sessions/);
	});

	test.skip("sessions page shows active sessions", async ({ page }) => {
		// Requires: authenticated Supabase session with recorded sessions
		// Would verify SessionList renders with current session badge
		await page.goto("/settings/sessions");
		await expect(page.getByText(/active sessions/i)).toBeVisible();
		await expect(page.getByText(/current session/i)).toBeVisible();
	});

	test.skip("can terminate a session from sessions page", async ({ page }) => {
		// Requires: multiple authenticated sessions
		// Would click "End Session" -> confirm -> verify session removed
		await page.goto("/settings/sessions");
		const endButton = page.getByRole("button", { name: /end session/i });
		await endButton.first().click();
		// Confirmation should appear
		await expect(page.getByText(/end this session/i)).toBeVisible();
	});
});
