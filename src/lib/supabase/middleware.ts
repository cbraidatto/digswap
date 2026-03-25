import { createServerClient } from "@supabase/ssr";
import { type NextRequest, NextResponse } from "next/server";

/**
 * Updates the auth session by refreshing the JWT token via getClaims().
 * Handles cookie synchronization between request and response.
 *
 * CRITICAL SECURITY: Uses getClaims() (never getSession()) to validate JWT.
 * getClaims() revalidates the JWT signature server-side.
 * getSession() does NOT and is unsafe for server code.
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
	// Always use getClaims() which revalidates the JWT signature server-side.
	const { data, error } = await supabase.auth.getClaims();
	const user = error ? null : data?.claims?.sub;

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
