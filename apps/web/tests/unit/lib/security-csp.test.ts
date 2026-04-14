import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { generateCspHeader } from "@/lib/security/csp";

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("generateCspHeader", () => {
	const NONCE = "dGVzdC1ub25jZQ=="; // base64 of "test-nonce"
	let originalEnv: string | undefined;

	beforeEach(() => {
		originalEnv = process.env.NEXT_PUBLIC_SUPABASE_URL;
	});

	afterEach(() => {
		if (originalEnv !== undefined) {
			process.env.NEXT_PUBLIC_SUPABASE_URL = originalEnv;
		} else {
			delete process.env.NEXT_PUBLIC_SUPABASE_URL;
		}
	});

	it("returns a string with all required directives", () => {
		process.env.NEXT_PUBLIC_SUPABASE_URL = "https://abc123.supabase.co";
		const csp = generateCspHeader(NONCE, false);

		expect(csp).toContain("default-src 'self'");
		expect(csp).toContain(`'nonce-${NONCE}'`);
		expect(csp).toContain("object-src 'none'");
		expect(csp).toContain("base-uri 'self'");
		expect(csp).toContain("frame-ancestors 'none'");
		expect(csp).toContain("form-action 'self'");
	});

	it("includes unsafe-eval in dev mode for HMR", () => {
		process.env.NEXT_PUBLIC_SUPABASE_URL = "https://abc123.supabase.co";
		const csp = generateCspHeader(NONCE, true);
		expect(csp).toContain("'unsafe-eval'");
	});

	it("excludes unsafe-eval in production mode", () => {
		process.env.NEXT_PUBLIC_SUPABASE_URL = "https://abc123.supabase.co";
		const csp = generateCspHeader(NONCE, false);
		expect(csp).not.toContain("'unsafe-eval'");
	});

	it("uses specific supabase hostname from env", () => {
		process.env.NEXT_PUBLIC_SUPABASE_URL = "https://myproject.supabase.co";
		const csp = generateCspHeader(NONCE, false);

		expect(csp).toContain("https://myproject.supabase.co");
		expect(csp).toContain("wss://myproject.supabase.co");
		// connect-src uses specific host, but img-src still uses wildcard for image CDN
		expect(csp).toMatch(/connect-src[^;]*myproject\.supabase\.co/);
	});

	it("falls back to wildcard when SUPABASE_URL is not set", () => {
		delete process.env.NEXT_PUBLIC_SUPABASE_URL;
		const csp = generateCspHeader(NONCE, false);

		expect(csp).toContain("*.supabase.co");
	});

	it("includes discogs image domains in img-src", () => {
		process.env.NEXT_PUBLIC_SUPABASE_URL = "https://abc123.supabase.co";
		const csp = generateCspHeader(NONCE, false);

		expect(csp).toContain("https://i.discogs.com");
		expect(csp).toContain("https://st.discogs.com");
	});

	it("includes google fonts in style-src and font-src", () => {
		process.env.NEXT_PUBLIC_SUPABASE_URL = "https://abc123.supabase.co";
		const csp = generateCspHeader(NONCE, false);

		expect(csp).toContain("https://fonts.googleapis.com");
		expect(csp).toContain("https://fonts.gstatic.com");
	});

	it("includes youtube in frame-src", () => {
		process.env.NEXT_PUBLIC_SUPABASE_URL = "https://abc123.supabase.co";
		const csp = generateCspHeader(NONCE, false);

		expect(csp).toContain("https://www.youtube-nocookie.com");
		expect(csp).toContain("https://www.youtube.com");
	});

	it("includes strict-dynamic in script-src", () => {
		process.env.NEXT_PUBLIC_SUPABASE_URL = "https://abc123.supabase.co";
		const csp = generateCspHeader(NONCE, false);

		expect(csp).toContain("'strict-dynamic'");
	});

	it("separates directives with semicolons", () => {
		process.env.NEXT_PUBLIC_SUPABASE_URL = "https://abc123.supabase.co";
		const csp = generateCspHeader(NONCE, false);

		const directives = csp.split("; ");
		expect(directives.length).toBeGreaterThanOrEqual(10);
	});
});
