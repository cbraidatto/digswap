import { expect, test } from "@playwright/test";

test.describe("Landing Page", () => {
	test("homepage loads with hero section", async ({ page }) => {
		await page.goto("/");
		await expect(page).toHaveTitle(/DigSwap/i);
	});

	test("homepage has sign up CTA", async ({ page }) => {
		await page.goto("/");
		const cta = page.getByRole("link", { name: /sign up|get started|create account/i });
		await expect(cta).toBeVisible();
	});

	test("homepage has sign in link", async ({ page }) => {
		await page.goto("/");
		// Header + footer both expose Sign In links — strict-mode safe via .first()
		const link = page.getByRole("link", { name: /sign in|log in/i }).first();
		await expect(link).toBeVisible();
	});
});
