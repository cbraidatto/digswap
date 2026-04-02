import { expect, test } from "@playwright/test";

/**
 * Pricing page smoke tests — public route, no auth required.
 * These run against the live dev server (see playwright.config.ts).
 *
 * Env prerequisite: NEXT_PUBLIC_STRIPE_PRICE_MONTHLY and
 * NEXT_PUBLIC_STRIPE_PRICE_ANNUAL must be set (can be test_ IDs).
 * Tests that trigger checkout are skipped when env vars are absent.
 */

test.describe("Pricing page — unauthenticated visitor", () => {
	test.beforeEach(async ({ page }) => {
		await page.goto("/pricing");
		// Wait for full JS hydration before any assertions or interactions.
		// PricingCards is a "use client" component — clicking billing toggle
		// before hydration means the onClick handler isn't attached yet.
		await page.waitForLoadState("networkidle");
	});

	test("page loads with both plan cards", async ({ page }) => {
		await expect(page).toHaveURL(/\/pricing/);
		// Free card
		await expect(page.getByText("$0")).toBeVisible();
		// Premium card
		await expect(page.getByText("MOST POPULAR")).toBeVisible();
	});

	test("Free card shows expected features", async ({ page }) => {
		await expect(page.getByText("5 trades per month")).toBeVisible();
		await expect(page.getByText("Full Discogs collection import")).toBeVisible();
	});

	test("Premium card shows expected features", async ({ page }) => {
		// exact: true avoids matching the hero paragraph "Go Premium for unlimited trades"
		await expect(page.getByText("Unlimited trades", { exact: true })).toBeVisible();
		await expect(page.getByText("Supporter badge on profile", { exact: true })).toBeVisible();
	});

	test("billing toggle switches displayed price", async ({ page }) => {
		// Default: monthly selected, monthly price shown
		await expect(page.getByText("$9.90")).toBeVisible();

		// Switch to annual
		await page.getByRole("button", { name: /ANNUAL/i }).click();

		// Annual equiv price shown
		await expect(page.getByText("$8.25")).toBeVisible();
		await expect(page.getByText(/billed annually/i)).toBeVisible();

		// Switch back to monthly
		await page.getByRole("button", { name: /MONTHLY/i }).click();
		await expect(page.getByText("$9.90")).toBeVisible();
	});

	test("SAVE 17% label is visible on annual toggle", async ({ page }) => {
		await expect(page.getByText(/SAVE 17%/i)).toBeVisible();
	});

	test("Free CTA links to /signup for unauthenticated visitor", async ({ page }) => {
		const freeCtaLink = page.getByRole("link", { name: /GET_STARTED_FREE/i });
		await expect(freeCtaLink).toBeVisible();
		await expect(freeCtaLink).toHaveAttribute("href", "/signup");
	});

	test("Premium CTA links to /signup for unauthenticated visitor", async ({ page }) => {
		// Unauthenticated — premium CTA is an anchor to /signup
		const premiumCtaLink = page.getByRole("link", { name: /UPGRADE_TO_PREMIUM/i });
		await expect(premiumCtaLink).toBeVisible();
		await expect(premiumCtaLink).toHaveAttribute("href", "/signup");
	});

	test("footer note is visible", async ({ page }) => {
		await expect(page.getByText(/Cancel anytime/i)).toBeVisible();
	});
});

test.describe("Pricing page — page structure", () => {
	test("page heading is visible", async ({ page }) => {
		await page.goto("/pricing");
		await expect(
			page.getByRole("heading", { name: /Choose your dig level/i }),
		).toBeVisible();
	});

	test("PRICING section label is visible", async ({ page }) => {
		await page.goto("/pricing");
		await expect(page.getByText("Pricing")).toBeVisible();
	});
});
