import { expect, test } from "@playwright/test";

// E2E navigation tests are scaffolded but marked fixme pending authenticated
// storageState fixture. When auth fixture is created (likely Phase 3+),
// change test.fixme() to test() and add storageState to test.use({}).

test.describe("Navigation Shell", () => {
	test.fixme("bottom bar displays 4 tabs with correct labels", async ({ page }) => {
		await page.goto("/feed");
		const nav = page.locator('nav[aria-label="Main navigation"]');
		await expect(nav).toBeVisible();
		await expect(nav.getByText("Feed")).toBeVisible();
		await expect(nav.getByText("Perfil")).toBeVisible();
		await expect(nav.getByText("Explorar")).toBeVisible();
		await expect(nav.getByText("Comunidade")).toBeVisible();
	});

	test.fixme("active tab is visually indicated on /feed", async ({ page }) => {
		await page.goto("/feed");
		const feedLink = page.locator('nav[aria-label="Main navigation"] a[href="/feed"]');
		await expect(feedLink).toHaveAttribute("aria-current", "page");
	});

	test.fixme("deep link to /explorar highlights Explorar tab", async ({ page }) => {
		await page.goto("/explorar");
		const explorarLink = page.locator('nav[aria-label="Main navigation"] a[href="/explorar"]');
		await expect(explorarLink).toHaveAttribute("aria-current", "page");
		const feedLink = page.locator('nav[aria-label="Main navigation"] a[href="/feed"]');
		await expect(feedLink).not.toHaveAttribute("aria-current", "page");
	});

	test.fixme("header displays VinylDig wordmark", async ({ page }) => {
		await page.goto("/feed");
		await expect(page.getByText("VinylDig")).toBeVisible();
	});

	test.fixme("clicking tab navigates to correct route", async ({ page }) => {
		await page.goto("/feed");
		await page.locator('nav[aria-label="Main navigation"]').getByText("Explorar").click();
		await expect(page).toHaveURL(/\/explorar/);
	});
});
