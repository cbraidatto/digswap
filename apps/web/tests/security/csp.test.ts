import { describe, expect, it } from "vitest";
import { generateCspHeader } from "@/lib/security/csp";

describe("Content Security Policy", () => {
	const testNonce = "dGVzdC1ub25jZS0xMjM0NTY=";

	describe("production mode (isDev=false)", () => {
		const csp = generateCspHeader(testNonce, false);

		it("includes nonce in script-src", () => {
			expect(csp).toContain(`'nonce-${testNonce}'`);
			expect(csp).toMatch(/script-src[^;]*'nonce-/);
		});

		it("uses nonce in style-src (no unsafe-inline)", () => {
			expect(csp).toMatch(/style-src[^;]*'nonce-/);
			expect(csp).not.toMatch(/style-src[^;]*'unsafe-inline'/);
		});

		it("does not include unsafe-inline in script-src", () => {
			// unsafe-inline must never appear in script-src (breaks XSS protection)
			const scriptSrc = csp.split(";").find((d) => d.trim().startsWith("script-src")) ?? "";
			expect(scriptSrc).not.toContain("'unsafe-inline'");
		});

		it("does not include unsafe-eval in production", () => {
			expect(csp).not.toContain("'unsafe-eval'");
		});

		it("sets frame-ancestors to none", () => {
			expect(csp).toContain("frame-ancestors 'none'");
		});

		it("sets form-action to self", () => {
			expect(csp).toContain("form-action 'self'");
		});

		it("allows supabase in connect-src", () => {
			// With NEXT_PUBLIC_SUPABASE_URL set (vitest config provides
			// "https://test.supabase.co"), the CSP uses the exact hostname
			// instead of the wildcard fallback.
			const supabaseHost = "test.supabase.co";
			expect(csp).toContain(`https://${supabaseHost}`);
			expect(csp).toContain(`wss://${supabaseHost}`);
		});

		it("is a single line with semicolon-separated directives", () => {
			expect(csp).not.toContain("\n");
			expect(csp.split("; ").length).toBeGreaterThanOrEqual(5);
		});
	});

	describe("development mode (isDev=true)", () => {
		const csp = generateCspHeader(testNonce, true);

		it("includes unsafe-eval for HMR", () => {
			expect(csp).toContain("'unsafe-eval'");
		});

		it("still includes nonce in script-src", () => {
			expect(csp).toMatch(/script-src[^;]*'nonce-/);
		});

		it("still sets frame-ancestors to none", () => {
			expect(csp).toContain("frame-ancestors 'none'");
		});
	});

	describe("nonce uniqueness", () => {
		it("produces different CSP strings for different nonces", () => {
			const csp1 = generateCspHeader("nonce-aaa", false);
			const csp2 = generateCspHeader("nonce-bbb", false);

			expect(csp1).not.toBe(csp2);
			expect(csp1).toContain("nonce-aaa");
			expect(csp2).toContain("nonce-bbb");
		});
	});

	describe("strict-dynamic", () => {
		it("includes strict-dynamic in script-src", () => {
			const csp = generateCspHeader(testNonce, false);
			expect(csp).toContain("'strict-dynamic'");
		});
	});
});
