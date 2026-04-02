"use client";

import { usePathname } from "next/navigation";
import { useEffect, useRef } from "react";
import { createClient } from "@/lib/supabase/client";

interface DesktopShellBridge {
	syncSession(
		session: {
			accessToken: string;
			refreshToken: string;
		} | null,
	): Promise<void>;
}

function getDesktopShell() {
	return (window as Window & { desktopShell?: DesktopShellBridge }).desktopShell;
}

/**
 * Syncs the current Supabase session into the Electron safeStorage vault.
 *
 * Two sync paths:
 * 1. Server-side auth (email/password, magic link): The server sets HttpOnly cookies
 *    that the browser Supabase client cannot read. We call GET /api/desktop/session
 *    which reads the cookies server-side and returns the tokens.
 *
 * 2. OAuth (Google, GitHub, Discogs): The OAuth callback goes through the browser
 *    client and fires onAuthStateChange — we sync from the event directly.
 *
 * We also re-sync on every pathname change because the root layout never remounts
 * and a server-side signin may have happened on a previous page.
 */
export function DesktopSessionSync() {
	const pathname = usePathname();
	const lastSyncedToken = useRef<string | null>(undefined);

	useEffect(() => {
		if (typeof window === "undefined") {
			return;
		}

		const desktopShell = getDesktopShell();
		if (!desktopShell) {
			return;
		}

		let active = true;

		const syncFromEndpoint = async () => {
			if (!active) return;

			try {
				const res = await fetch("/api/desktop/session", { credentials: "same-origin" });
				if (!res.ok) return;

				const data = (await res.json()) as {
					accessToken: string;
					refreshToken: string;
				} | null;

				if (!active) return;

				const token = data?.accessToken ?? null;

				// Skip if we already synced this exact token (avoid redundant vault writes)
				if (token === lastSyncedToken.current) return;
				lastSyncedToken.current = token;

				if (data?.accessToken && data.refreshToken) {
					await desktopShell.syncSession({
						accessToken: data.accessToken,
						refreshToken: data.refreshToken,
					});
				} else {
					await desktopShell.syncSession(null);
				}
			} catch (error) {
				console.error("[desktop-session-sync] fetch failed", error);
			}
		};

		void syncFromEndpoint();

		// OAuth flows go through browser client — pick them up via onAuthStateChange
		const supabase = createClient();
		const {
			data: { subscription },
		} = supabase.auth.onAuthStateChange((_event, session) => {
			if (!active) return;

			const token = session?.access_token ?? null;
			if (token === lastSyncedToken.current) return;
			lastSyncedToken.current = token;

			void (async () => {
				try {
					if (session?.access_token && session.refresh_token) {
						await desktopShell.syncSession({
							accessToken: session.access_token,
							refreshToken: session.refresh_token,
						});
					} else {
						await desktopShell.syncSession(null);
					}
				} catch (error) {
					console.error("[desktop-session-sync] auth state sync failed", error);
				}
			})();
		});

		return () => {
			active = false;
			subscription.unsubscribe();
		};
	// Re-sync on pathname change to catch server-side logins on previous pages
	// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [pathname]);

	return null;
}
