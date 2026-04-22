import { expect, test } from "../e2e/fixtures/auth";

/**
 * Settings E2E tests.
 * Requires authenticated session (auto-skipped without E2E env vars).
 */
test.describe("Settings", () => {
	test("settings page loads", async ({ authedPage: page }) => {
		await page.goto("/settings");
		await expect(page).toHaveTitle(/DigSwap/i);
		const content = page.locator("main");
		await expect(content).toBeVisible();
	});

	test("sessions settings page loads", async ({ authedPage: page }) => {
		await page.goto("/settings/sessions");
		await expect(page).toHaveTitle(/DigSwap/i);
	});

	test("billing settings page loads", async ({ authedPage: page }) => {
		await page.goto("/settings/billing");
		await expect(page).toHaveTitle(/DigSwap/i);
	});
});
