import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

/**
 * Validates a redirect path to prevent open redirect attacks.
 * - Must start with "/"
 * - Must NOT start with "//" (protocol-relative)
 * - Must NOT contain "://" (absolute URL with protocol)
 * Falls back to /onboarding if validation fails.
 */
function validateRedirectPath(next: string | null): string {
	const fallback = "/onboarding";
	if (!next) return fallback;
	if (!next.startsWith("/") || next.startsWith("//") || next.includes("://")) {
		return fallback;
	}
	return next;
}

/**
 * OAuth and email verification callback handler.
 *
 * Handles BOTH:
 * 1. OAuth callbacks (Google/GitHub) -- exchanges auth code for session
 * 2. Email verification link callbacks (PKCE flow) -- exchanges code for session
 *
 * Per D-06: new users redirect to /onboarding after successful auth.
 * Per D-09: uses exchangeCodeForSession for PKCE flow.
 */
export async function GET(request: Request) {
	const { searchParams, origin } = new URL(request.url);
	const code = searchParams.get("code");
	const next = validateRedirectPath(searchParams.get("next"));

	if (code) {
		const supabase = await createClient();
		const { error } = await supabase.auth.exchangeCodeForSession(code);

		if (!error) {
			return NextResponse.redirect(`${origin}${next}`);
		}
	}

	// Auth callback failed -- redirect to signin with error
	return NextResponse.redirect(`${origin}/signin?error=auth_callback_failed`);
}
