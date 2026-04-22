import { expect, test } from "../e2e/fixtures/auth";

/**
 * Explore/Discovery E2E tests.
 * Requires authenticated session (auto-skipped without E2E env vars).
 */
test.describe("Explore", () => {
	test("explore page loads", async ({ authedPage: page }) => {
		await page.goto("/explorar");
		await expect(page).toHaveTitle(/DigSwap/i);
		const content = page.locator("main");
		await expect(content).toBeVisible();
	});
});
