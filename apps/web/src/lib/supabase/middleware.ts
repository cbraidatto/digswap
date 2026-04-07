import { createServerClient } from "@supabase/ssr";
import { type NextRequest, NextResponse } from "next/server";
import { extractSessionId } from "@/lib/auth/session-utils";

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
		process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY! || process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
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
	const {
		data: { user },
	} = await supabase.auth.getUser();

	const { pathname } = request.nextUrl;

	// Session allowlist check — validates revoked sessions without calling getSession()
	// (getSession() in middleware interferes with OAuth PKCE cookie flow)
	//
	// Approach: extract session_id from the JWT that getUser() already validated,
	// then check if it exists in our user_sessions tracking table.
	// Only block when user HAS tracked sessions but current isn't among them.
	if (user) {
		const isProtectedPath =
			!pathname.startsWith("/signin") &&
			!pathname.startsWith("/signup") &&
			!pathname.startsWith("/forgot-password") &&
			!pathname.startsWith("/reset-password") &&
			!pathname.startsWith("/api/stripe/") &&
			!pathname.startsWith("/api/og/") &&
			!pathname.startsWith("/api/discogs/import") &&
			!pathname.startsWith("/api/desktop/") &&
			!pathname.startsWith("/onboarding");

		if (isProtectedPath) {
			try {
				// Read the access token directly from cookies instead of calling getSession()
				const projectRef = process.env.NEXT_PUBLIC_SUPABASE_URL?.match(/\/\/([^.]+)\./)?.[1];
				const accessTokenCookie = projectRef
					? request.cookies.get(`sb-${projectRef}-auth-token`)?.value
					: null;

				// The cookie stores a JSON array: [access_token, refresh_token, ...]
				// or in newer versions it may be a single token
				let accessToken: string | null = null;
				if (accessTokenCookie) {
					try {
						const parsed = JSON.parse(
							accessTokenCookie.startsWith("base64-")
								? Buffer.from(accessTokenCookie.slice(7), "base64").toString()
								: accessTokenCookie,
						);
						accessToken = Array.isArray(parsed) ? parsed[0] : parsed;
					} catch {
						accessToken = accessTokenCookie;
					}
				}

				const supabaseSessionId = accessToken ? extractSessionId(accessToken) : null;

				if (supabaseSessionId) {
					const { data: allSessions } = await supabase
						.from("user_sessions")
						.select("session_id")
						.eq("user_id", user.id);

					if (allSessions && allSessions.length > 0) {
						const isTracked = allSessions.some(
							(s: { session_id: string }) => s.session_id === supabaseSessionId,
						);

						if (!isTracked) {
							await supabase.auth.signOut();
							const url = request.nextUrl.clone();
							url.pathname = "/signin";
							return NextResponse.redirect(url);
						}
					}
				}
			} catch (err) {
				// Fail-closed: if session allowlist check fails, force re-auth.
				// A revoked session must not slip through due to a transient DB error.
				console.error("[middleware] session allowlist check failed — forcing sign-out:", err);
				await supabase.auth.signOut();
				const url = request.nextUrl.clone();
				url.pathname = "/signin";
				return NextResponse.redirect(url);
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
		"/crates", // M-16: added — under (protected) layout
		"/radar", // M-16: added — under (protected) layout
		"/wrapped", // M-16: added — under (protected) layout
		"/trades", // M-16: added — under (protected) layout
		"/notifications", // M-16: added — under (protected) layout
		"/como-usar",
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
