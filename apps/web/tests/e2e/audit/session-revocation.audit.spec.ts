import { expect, request as pwRequest, test } from "@playwright/test";

// DEP-AUD-04: a logged-out JWT must return 401 on protected API routes within 60s.
// This is a "claim verification" test produced by Phase 33's audit —
// it runs against the LOCAL prod server (pnpm start on :3000).
// Scaffolded in Plan 01 (Wave 0); executed in Plan 04 (Wave 2).
//
// Required env vars at run-time (Plan 04 supplies these):
//   AUDIT_USER_EMAIL    — pre-created audit user (audit+33@digswap.test recommended)
//   AUDIT_USER_PASSWORD — password for the audit user
//   NEXT_PUBLIC_SUPABASE_URL — inherited from .env.local via pnpm start

test("logged-out JWT is rejected within 60s", async ({ page }) => {
	const AUDIT_EMAIL = process.env.AUDIT_USER_EMAIL;
	const AUDIT_PASSWORD = process.env.AUDIT_USER_PASSWORD;
	expect(AUDIT_EMAIL, "AUDIT_USER_EMAIL env var required").toBeTruthy();
	expect(AUDIT_PASSWORD, "AUDIT_USER_PASSWORD env var required").toBeTruthy();

	// 1. Sign in with the audit user
	await page.goto("http://localhost:3000/signin");
	await page.fill('input[name="email"]', AUDIT_EMAIL!);
	await page.fill('input[name="password"]', AUDIT_PASSWORD!);
	await page.click('button[type="submit"]');
	await page.waitForURL(/\/feed|\/onboarding/, { timeout: 10_000 });

	// 2. Extract the access token from the Supabase auth cookie
	const cookies = await page.context().cookies();
	const projectRef = new URL(process.env.NEXT_PUBLIC_SUPABASE_URL!).hostname.split(".")[0];
	const authCookieName = `sb-${projectRef}-auth-token`;
	const authCookie = cookies.find((c) => c.name === authCookieName);
	expect(authCookie, "must have auth cookie after signin").toBeDefined();

	// Cookie may be JSON array or base64-prefixed (Supabase SSR changed formats in 2025)
	let rawValue = authCookie!.value;
	if (rawValue.startsWith("base64-")) {
		rawValue = Buffer.from(rawValue.slice(7), "base64").toString();
	}
	const parsed = JSON.parse(decodeURIComponent(rawValue));
	const accessToken = Array.isArray(parsed) ? parsed[0] : parsed.access_token;
	expect(accessToken, "must extract access_token").toBeTruthy();

	// Picked in Plan 04 Task 1: /api/user/me (created specifically for this audit — returns 401 without a valid session).
	// See .planning/phases/033-pre-deploy-audit-gate/evidence/04-protected-endpoint.txt.
	const PROTECTED_ENDPOINT = "http://localhost:3000/api/user/me";

	const apiClient = await pwRequest.newContext();
	const preLogoutResp = await apiClient.get(PROTECTED_ENDPOINT, {
		headers: { Authorization: `Bearer ${accessToken}` },
	});
	console.log("[audit] pre-logout status:", preLogoutResp.status());
	expect(preLogoutResp.status(), "token must work before logout").toBeLessThan(400);

	// 4. Log out via the UI
	await page.goto("http://localhost:3000/settings/sessions");
	await page.click("text=/sign.*out/i");
	await page.waitForURL(/\/signin/, { timeout: 10_000 });

	// 5. Replay the token — expect 401 within 60s
	const start = Date.now();
	let finalStatus = 0;
	while (Date.now() - start < 60_000) {
		const resp = await apiClient.get(PROTECTED_ENDPOINT, {
			headers: { Authorization: `Bearer ${accessToken}` },
		});
		finalStatus = resp.status();
		if (finalStatus === 401) break;
		await new Promise((r) => setTimeout(r, 2_000));
	}
	const elapsedMs = Date.now() - start;
	console.log(`[audit] post-logout status: ${finalStatus} after ${elapsedMs}ms`);
	expect(finalStatus, "logged-out token must return 401").toBe(401);
	expect(elapsedMs, "must be rejected within 60s").toBeLessThan(60_000);
});
