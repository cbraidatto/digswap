import { test, expect } from "../e2e/fixtures/auth";

/**
 * Collection management E2E tests.
 * Requires authenticated session (auto-skipped without E2E env vars).
 */
test.describe("Collection", () => {
	test("collection page loads and shows grid or empty state", async ({ authedPage: page }) => {
		await page.goto("/perfil");
		await expect(page).toHaveTitle(/DigSwap/i);
		// Should show either collection grid or empty state prompt
		const content = page.locator("main");
		await expect(content).toBeVisible();
	});
});
