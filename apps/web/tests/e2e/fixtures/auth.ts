import { type Page, test as base, expect } from "@playwright/test";

/**
 * Auth fixture for E2E tests requiring an authenticated session.
 *
 * Usage:
 *   import { test, expect } from "../fixtures/auth";
 *   test("my test", async ({ authedPage }) => { ... });
 *
 * Requires env vars:
 *   E2E_USER_EMAIL - test user email
 *   E2E_USER_PASSWORD - test user password
 *
 * When env vars are missing, tests using `authedPage` are auto-skipped.
 */

export const test = base.extend<{ authedPage: Page }>({
	authedPage: async ({ page }, use, testInfo) => {
		const email = process.env.E2E_USER_EMAIL;
		const password = process.env.E2E_USER_PASSWORD;

		if (!email || !password) {
			testInfo.skip(true, "E2E_USER_EMAIL and E2E_USER_PASSWORD required");
			return;
		}

		// Sign in via the UI
		await page.goto("/signin");
		await page.getByLabel(/email/i).fill(email);
		await page.getByLabel(/password/i).fill(password);
		await page.getByRole("button", { name: /sign in|log in/i }).click();

		// Wait for redirect away from signin
		await expect(page).not.toHaveURL(/\/signin/);

		await use(page as any);
	},
});

export { expect };
