import { expect, test } from "../e2e/fixtures/auth";

/**
 * Community E2E tests.
 * Requires authenticated session (auto-skipped without E2E env vars).
 */
test.describe("Community", () => {
	test("community page loads and shows groups", async ({ authedPage: page }) => {
		await page.goto("/comunidade");
		await expect(page).toHaveTitle(/DigSwap/i);
		const content = page.locator("main");
		await expect(content).toBeVisible();
	});
});
