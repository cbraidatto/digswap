import { expect, test } from "../e2e/fixtures/auth";

/**
 * Notifications E2E tests.
 * Requires authenticated session (auto-skipped without E2E env vars).
 */
test.describe("Notifications", () => {
	test("notifications page loads", async ({ authedPage: page }) => {
		await page.goto("/notifications");
		await expect(page).toHaveTitle(/DigSwap/i);
		const content = page.locator("main");
		await expect(content).toBeVisible();
	});
});
