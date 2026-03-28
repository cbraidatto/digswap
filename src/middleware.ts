import { type NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";

export async function middleware(request: NextRequest) {
	return await updateSession(request);
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
