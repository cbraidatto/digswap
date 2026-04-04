import { describe, it, expect } from "vitest";

/**
 * Security header tests (SEC-01, D-17, D-20).
 *
 * These tests verify that OWASP-required security headers are configured
 * in next.config.ts. They test the config object directly rather than
 * making HTTP requests, so they don't require a running server.
 *
 * For full integration testing against a running server, use the E2E tests
 * or run: curl -I http://localhost:3000
 */

// Import the Next.js config to verify headers are configured
// We parse the config file directly to verify header presence

describe("Security Headers Configuration", () => {
	let securityHeaders: Array<{ key: string; value: string }>;

	// Dynamically import next.config.ts and extract headers
	// Since next.config.ts uses export default, we import it as a module
	it("next.config.ts exports headers function", async () => {
		// Read the next.config.ts content and verify headers array
		const fs = await import("node:fs");
		const path = await import("node:path");
		const configPath = path.resolve(process.cwd(), "next.config.ts");
		const configContent = fs.readFileSync(configPath, "utf-8");

		// Extract the securityHeaders array from the config content
		// This is a static analysis approach that doesn't require running Next.js
		expect(configContent).toContain("securityHeaders");
		expect(configContent).toContain("headers()");

		// Parse individual headers from the config content
		securityHeaders = [];

		// Check each required header exists in the config
		// CSP is handled per-request in middleware (nonce-based), not in next.config.ts
		const requiredHeaders = [
			{ key: "X-Frame-Options", value: "DENY" },
			{ key: "Strict-Transport-Security", value: "max-age=" },
			{ key: "X-Content-Type-Options", value: "nosniff" },
			{ key: "Referrer-Policy", value: "" },
			{ key: "Permissions-Policy", value: "" },
		];

		for (const header of requiredHeaders) {
			expect(configContent).toContain(header.key);
		}
	});

	it("includes X-Frame-Options set to DENY", async () => {
		const fs = await import("node:fs");
		const path = await import("node:path");
		const configPath = path.resolve(process.cwd(), "next.config.ts");
		const content = fs.readFileSync(configPath, "utf-8");

		expect(content).toContain('"X-Frame-Options"');
		expect(content).toContain('"DENY"');
	});

	it("includes Strict-Transport-Security with max-age", async () => {
		const fs = await import("node:fs");
		const path = await import("node:path");
		const configPath = path.resolve(process.cwd(), "next.config.ts");
		const content = fs.readFileSync(configPath, "utf-8");

		expect(content).toContain('"Strict-Transport-Security"');
		expect(content).toMatch(/max-age=\d+/);
	});

	it("includes X-Content-Type-Options set to nosniff", async () => {
		const fs = await import("node:fs");
		const path = await import("node:path");
		const configPath = path.resolve(process.cwd(), "next.config.ts");
		const content = fs.readFileSync(configPath, "utf-8");

		expect(content).toContain('"X-Content-Type-Options"');
		expect(content).toContain('"nosniff"');
	});

	it("CSP is handled by middleware (not static next.config headers)", async () => {
		// CSP uses per-request nonces — it cannot be a static header in next.config.ts.
		// Verify the middleware file has the CSP generator reference.
		const fs = await import("node:fs");
		const path = await import("node:path");
		const middlewarePath = path.resolve(process.cwd(), "src/middleware.ts");
		const content = fs.readFileSync(middlewarePath, "utf-8");

		expect(content).toContain("Content-Security-Policy");
		expect(content).toContain("generateCspHeader");
	});

	it("includes Referrer-Policy header", async () => {
		// Referrer-Policy is intentionally set in middleware (not next.config)
		// to avoid conflicting values — middleware sets the stricter
		// "strict-origin-when-cross-origin" on every response.
		// See: middleware.ts SEC-02 block and security audit L-04.
		const fs = await import("node:fs");
		const path = await import("node:path");
		const middlewarePath = path.resolve(process.cwd(), "src/middleware.ts");
		const content = fs.readFileSync(middlewarePath, "utf-8");

		expect(content).toContain("Referrer-Policy");
		expect(content).toContain("strict-origin-when-cross-origin");
	});

	it("includes Permissions-Policy header", async () => {
		const fs = await import("node:fs");
		const path = await import("node:path");
		const configPath = path.resolve(process.cwd(), "next.config.ts");
		const content = fs.readFileSync(configPath, "utf-8");

		expect(content).toContain('"Permissions-Policy"');
		// Verify restrictive policy -- camera, microphone, geolocation disabled
		expect(content).toContain("camera=()");
		expect(content).toContain("microphone=()");
		expect(content).toContain("geolocation=()");
	});

	it("applies headers to all routes via /(.*) pattern", async () => {
		const fs = await import("node:fs");
		const path = await import("node:path");
		const configPath = path.resolve(process.cwd(), "next.config.ts");
		const content = fs.readFileSync(configPath, "utf-8");

		// Verify the source pattern applies headers globally
		expect(content).toContain('"/(.*)"');
	});
});
