import { createServerClient } from "@supabase/ssr";
import { type NextRequest, NextResponse } from "next/server";

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
