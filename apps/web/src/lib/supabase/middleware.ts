import { createServerClient } from "@supabase/ssr";
import { type NextRequest, NextResponse } from "next/server";

/**
 * Extract the Supabase session ID (sub claim `session_id`) from a JWT access token.
 * The JWT payload is base64url-encoded in the second segment.
 */
function extractSessionId(accessToken: string): string | null {
	try {
		const payload = accessToken.split(".")[1];
		if (!payload) return null;
		const decoded = JSON.parse(Buffer.from(payload, "base64url").toString());
		return decoded.session_id ?? null;
	} catch {
		return null;
	}
}

/**
 * Updates the auth session, refreshing the JWT token if expired.
 * Handles cookie synchronization between request and response.
 *
 * Uses getUser() which both validates the JWT server-side AND automatically
 * refreshes expired tokens via the refresh token in cookies — essential for
 * middleware to keep sessions alive across page navigations.
 * Never use getSession() here; it trusts the cookie without revalidation.
 */
export async function updateSession(request: NextRequest) {
	let supabaseResponse = NextResponse.next({
		request,
	});

	const supabase = createServerClient(
		process.env.NEXT_PUBLIC_SUPABASE_URL!,
		process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
		{
			cookies: {
				getAll() {
					return request.cookies.getAll();
				},
				setAll(cookiesToSet) {
					for (const { name, value } of cookiesToSet) {
						request.cookies.set(name, value);
					}
					supabaseResponse = NextResponse.next({
						request,
					});
					for (const { name, value, options } of cookiesToSet) {
						supabaseResponse.cookies.set(name, value, options);
					}
				},
			},
		},
	);

	// IMPORTANT: Do NOT use supabase.auth.getSession() -- it doesn't validate JWT.
	// getUser() validates the JWT server-side AND refreshes expired tokens via
	// the refresh token cookie, keeping sessions alive across navigations.
	const { data: { user } } = await supabase.auth.getUser();

	const { pathname } = request.nextUrl;

	// Session allowlist check: verify the user's Supabase session is still tracked
	// in our user_sessions table. If it was revoked via "terminate session", the
	// JWT may still be valid but our allowlist won't contain it.
	//
	// IMPORTANT: Only block when the user HAS tracked sessions but the current
	// one isn't among them. If the user has zero tracked sessions (new OAuth
	// login, onboarding), let them through — it's not a revoked session.
	if (user) {
		const isProtectedPath = !pathname.startsWith("/signin") &&
			!pathname.startsWith("/signup") &&
			!pathname.startsWith("/forgot-password") &&
			!pathname.startsWith("/reset-password") &&
			!pathname.startsWith("/api/") &&
			!pathname.startsWith("/onboarding");

		if (isProtectedPath) {
			try {
				const { data: { session } } = await supabase.auth.getSession();
				const supabaseSessionId = session?.access_token
					? extractSessionId(session.access_token)
					: null;

				if (supabaseSessionId) {
					// Get ALL tracked sessions for this user
					const { data: allSessions } = await supabase
						.from("user_sessions")
						.select("session_id")
						.eq("user_id", user.id);

					// Only enforce allowlist if user has tracked sessions
					// (zero sessions = new login not yet registered, not a revocation)
					if (allSessions && allSessions.length > 0) {
						const isTracked = allSessions.some(
							(s: { session_id: string }) => s.session_id === supabaseSessionId,
						);

						if (!isTracked) {
							// Session was revoked — sign out and redirect
							await supabase.auth.signOut();
							const url = request.nextUrl.clone();
							url.pathname = "/signin";
							return NextResponse.redirect(url);
						}
					}
				}
			} catch {
				// Non-blocking: if allowlist check fails, let the request through
			}
		}
	}

	// Protected routes: redirect unauthenticated users to /signin
	const protectedPaths = [
		"/onboarding",
		"/settings",
		"/profile",
		"/feed",
		"/explorar",
		"/comunidade",
		"/import-progress",
	];
	const isProtectedRoute = protectedPaths.some((path) => pathname.startsWith(path));
	// /perfil is protected ONLY as exact path (own profile), not /perfil/[username] (public profile)
	const isOwnProfile = pathname === "/perfil" || pathname === "/perfil/";

	if (!user && (isProtectedRoute || isOwnProfile)) {
		const url = request.nextUrl.clone();
		url.pathname = "/signin";
		return NextResponse.redirect(url);
	}

	// Auth routes: redirect authenticated users away from auth pages
	const authPaths = ["/signin", "/signup", "/forgot-password"];
	const isAuthRoute = authPaths.some((path) => pathname.startsWith(path));

	if (user && isAuthRoute) {
		const url = request.nextUrl.clone();
		// Default redirect for authenticated users
		url.pathname = "/feed";
		return NextResponse.redirect(url);
	}

	return supabaseResponse;
}
