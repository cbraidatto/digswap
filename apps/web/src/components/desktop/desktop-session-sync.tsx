"use client";

import { usePathname } from "next/navigation";
import { useEffect, useRef } from "react";

interface DesktopShellBridge {
	/**
	 * Receives a single-use handoff code that the desktop app exchanges
	 * server-side for a session. The browser never sees the actual tokens.
	 */
	syncHandoffCode(code: string | null): Promise<void>;
}

function getDesktopShell() {
	return (window as Window & { desktopShell?: DesktopShellBridge }).desktopShell;
}

/**
 * Syncs auth state to the Electron desktop shell via a single-use handoff code.
 *
 * Security model:
 * 1. Browser requests a handoff code from POST /api/desktop/session
 * 2. Code is passed to desktopShell.syncHandoffCode() (no tokens in browser JS)
 * 3. Desktop app exchanges the code server-side at /api/desktop/session/exchange
 * 4. Code is single-use and expires in 30 seconds
 */
export function DesktopSessionSync() {
	const _pathname = usePathname();
	const lastSyncedAt = useRef<number>(0);

	useEffect(() => {
		if (typeof window === "undefined") return;

		const desktopShell = getDesktopShell();
		if (!desktopShell) return;

		let active = true;

		const syncHandoff = async () => {
			if (!active) return;

			// Debounce: don't sync more than once every 5 seconds
			const now = Date.now();
			if (now - lastSyncedAt.current < 5000) return;
			lastSyncedAt.current = now;

			try {
				const res = await fetch("/api/desktop/session", {
					method: "POST",
					credentials: "same-origin",
				});

				if (!res.ok) {
					// Not authenticated or rate limited — clear desktop session
					if (desktopShell.syncHandoffCode) {
						await desktopShell.syncHandoffCode(null);
					}
					return;
				}

				const data = (await res.json()) as { code: string; expiresIn: number } | null;
				if (!active || !data?.code) return;

				if (desktopShell.syncHandoffCode) {
					await desktopShell.syncHandoffCode(data.code);
				}
			} catch (error) {
				console.error("[desktop-session-sync] handoff failed", error);
			}
		};

		void syncHandoff();

		return () => {
			active = false;
		};
	}, []);

	return null;
}
