import { describe, it, expect } from "vitest";
import { generateCspHeader } from "@/lib/security/csp";

describe("Content Security Policy", () => {
	const testNonce = "dGVzdC1ub25jZS0xMjM0NTY=";

	describe("production mode (isDev=false)", () => {
		const csp = generateCspHeader(testNonce, false);

		it("includes nonce in script-src", () => {
			expect(csp).toContain(`'nonce-${testNonce}'`);
			expect(csp).toMatch(/script-src[^;]*'nonce-/);
		});

		it("uses unsafe-inline in style-src (required for Sonner inline style= attrs)", () => {
			// style= attributes cannot use nonces — only <style> tags can.
			// Sonner injects inline style= at runtime, so unsafe-inline is required here.
			expect(csp).toMatch(/style-src[^;]*'unsafe-inline'/);
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
			expect(csp).toContain("https://*.supabase.co");
			expect(csp).toContain("wss://*.supabase.co");
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
