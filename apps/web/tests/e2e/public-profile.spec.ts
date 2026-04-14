import { expect, test } from "@playwright/test";

test.describe("Public Profile", () => {
	test("public profile page renders for valid username", async ({ page }) => {
		// Navigate to a username URL — even if user doesn't exist,
		// the page should render (with "not found" state)
		await page.goto("/perfil/testuser");
		await expect(page).toHaveTitle(/DigSwap/i);
	});
});
