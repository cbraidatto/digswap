import { expect, test } from "@playwright/test";

test.describe("Release Page", () => {
	test("release page renders for a valid discogs ID", async ({ page }) => {
		// Use a common Discogs release ID for testing
		await page.goto("/release/249504");
		await expect(page).toHaveTitle(/DigSwap/i);
	});
});
