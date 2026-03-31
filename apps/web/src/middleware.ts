import { type NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";
import { generateCspHeader } from "@/lib/security/csp";

export async function middleware(request: NextRequest) {
	const nonce = Buffer.from(crypto.randomUUID()).toString("base64");
	const isDev = process.env.NODE_ENV === "development";
	const cspHeader = generateCspHeader(nonce, isDev);

	// Clone request headers to add nonce for downstream consumption
	const requestHeaders = new Headers(request.headers);
	requestHeaders.set("x-nonce", nonce);
	requestHeaders.set("Content-Security-Policy", cspHeader);

	// Pass modified request to session handler
	const response = await updateSession(request);

	// Set CSP on the response
	response.headers.set("Content-Security-Policy", cspHeader);
	response.headers.set("x-nonce", nonce);

	return response;
}

export const config = {
	matcher: [
		/*
		 * Match all request paths except for:
		 * - _next/static (static files)
		 * - _next/image (image optimization files)
		 * - favicon.ico (favicon file)
		 * - Common image file extensions
		 * - api/og/* (OG image generation routes — public, no auth needed, WASM-sensitive)
		 */
		"/((?!_next/static|_next/image|favicon.ico|api/og/|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
	],
};
