import { defineConfig, devices } from "@playwright/test";

/**
 * Playwright E2E test configuration for DigSwap.
 *
 * Uses Chromium only for speed (solo developer workflow).
 * When PLAYWRIGHT_BASE_URL is set to a remote https URL (e.g. *.vercel.app),
 * skip the local dev server. When unset or pointing at localhost, auto-start
 * `pnpm dev` for local development.
 */
const BASE_URL = process.env.PLAYWRIGHT_BASE_URL ?? "http://localhost:3000";
const isRemote = BASE_URL.startsWith("https://");

export default defineConfig({
	testDir: "tests/e2e",
	timeout: 30_000,
	expect: {
		timeout: 5_000,
	},
	fullyParallel: true,
	forbidOnly: !!process.env.CI,
	retries: process.env.CI ? 2 : 0,
	workers: process.env.CI ? 1 : undefined,
	reporter: "html",

	use: {
		baseURL: BASE_URL,
		trace: "on-first-retry",
	},

	projects: [
		{
			name: "chromium",
			use: { ...devices["Desktop Chrome"] },
		},
	],

	// Only auto-start dev server when targeting localhost.
	...(isRemote
		? {}
		: {
				webServer: {
					command: "pnpm dev",
					url: "http://localhost:3000",
					reuseExistingServer: !process.env.CI,
					timeout: 120_000,
				},
			}),
});
