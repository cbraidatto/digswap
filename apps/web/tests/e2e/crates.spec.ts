import { expect, test } from "../e2e/fixtures/auth";

/**
 * Crates E2E tests.
 * Requires authenticated session (auto-skipped without E2E env vars).
 */
test.describe("Crates", () => {
	test("crates page loads", async ({ authedPage: page }) => {
		await page.goto("/crates");
		await expect(page).toHaveTitle(/DigSwap/i);
		const content = page.locator("main");
		await expect(content).toBeVisible();
	});
});
