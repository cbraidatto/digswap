import { expect, test } from "../e2e/fixtures/auth";

/**
 * Onboarding E2E tests.
 * Requires authenticated session (auto-skipped without E2E env vars).
 */
test.describe("Onboarding", () => {
	test("onboarding page loads with first step", async ({ authedPage: page }) => {
		await page.goto("/onboarding");
		await expect(page).toHaveTitle(/DigSwap/i);
		const content = page.locator("main");
		await expect(content).toBeVisible();
	});
});
