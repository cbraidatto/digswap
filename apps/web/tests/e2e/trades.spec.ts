import { test, expect } from "../e2e/fixtures/auth";

/**
 * Trade flow E2E tests.
 * Requires authenticated session (auto-skipped without E2E env vars).
 */
test.describe("Trades", () => {
	test("trades list page loads", async ({ authedPage: page }) => {
		await page.goto("/trades");
		await expect(page).toHaveTitle(/DigSwap/i);
		const content = page.locator("main");
		await expect(content).toBeVisible();
	});
});
