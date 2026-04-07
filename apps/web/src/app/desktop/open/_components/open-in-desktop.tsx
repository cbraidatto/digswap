"use client";

/**
 * Client component for the /desktop/open handoff page.
 *
 * On mount, fires the digswap:// protocol handler and waits up to 1.5s for
 * the desktop app to respond (via visibilitychange). If no response arrives,
 * shows OS-specific download links.
 *
 * States:
 * - opening: default, protocol handler fired
 * - success: tab blur detected — app likely opened
 * - not-installed: 1.5s timeout elapsed, no response
 * - version-blocked: desktop version < minVersion
 *
 * See: ADR-002-desktop-trade-runtime.md D-08
 */

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";

type OpenState = "opening" | "success" | "not-installed" | "version-blocked";

interface OpenInDesktopProps {
	tradeId: string;
	token: string;
	minVersion: number;
	/** Optional desktop version reported back via ?dv= URL param */
	desktopVersion?: number;
}

/** Detect OS from user agent for download link selection */
function detectOs(): "windows" | "mac" | "linux" {
	if (typeof navigator === "undefined") return "linux";
	const ua = navigator.userAgent;
	if (/Win/.test(ua)) return "windows";
	if (/Mac/.test(ua)) return "mac";
	return "linux";
}

function getDownloadLink(os: "windows" | "mac" | "linux"): {
	href: string;
	label: string;
} {
	switch (os) {
		case "windows":
			return { href: "/downloads/digswap-setup.exe", label: "Download for Windows (.exe)" };
		case "mac":
			return { href: "/downloads/digswap.dmg", label: "Download for macOS (.dmg)" };
		default:
			return { href: "/downloads/digswap.AppImage", label: "Download for Linux (.AppImage)" };
	}
}

export function OpenInDesktop({ tradeId, token, minVersion, desktopVersion }: OpenInDesktopProps) {
	const [state, setState] = useState<OpenState>(() => {
		// Version gate check on initial render
		if (
			desktopVersion !== undefined &&
			!Number.isNaN(desktopVersion) &&
			desktopVersion < minVersion
		) {
			return "version-blocked";
		}
		return "opening";
	});

	const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
	const os = detectOs();
	const { href: downloadHref, label: downloadLabel } = getDownloadLink(os);
	const protocolUrl = `digswap://trade/${tradeId}?handoff=${token}`;

	const fireProtocolOpen = useCallback(() => {
		window.location.href = protocolUrl;
	}, [protocolUrl]);

	useEffect(() => {
		// If version-blocked, do not attempt to open the protocol handler
		if (state === "version-blocked") return;

		// Fire protocol handler immediately
		fireProtocolOpen();

		// 1.5s fallback: if tab is still visible, app is likely not installed
		timeoutRef.current = setTimeout(() => {
			if (!document.hidden) {
				setState("not-installed");
			}
		}, 1500);

		// visibilitychange: if the tab becomes hidden, the desktop app opened
		const handleVisibilityChange = () => {
			if (document.hidden) {
				if (timeoutRef.current) {
					clearTimeout(timeoutRef.current);
					timeoutRef.current = null;
				}
				setState("success");
			}
		};

		document.addEventListener("visibilitychange", handleVisibilityChange);

		return () => {
			if (timeoutRef.current) {
				clearTimeout(timeoutRef.current);
			}
			document.removeEventListener("visibilitychange", handleVisibilityChange);
		};
		// Run only once on mount — state changes after mount are intentional
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [
		// Fire protocol handler immediately
		fireProtocolOpen,
		state,
	]);

	// -------------------------------------------------------------------------
	// Render states
	// -------------------------------------------------------------------------

	if (state === "version-blocked") {
		return (
			<div className="flex flex-col items-center gap-6 text-center">
				<div className="space-y-2">
					<h2 className="font-heading text-xl font-semibold text-foreground">
						Desktop app update required
					</h2>
					<p className="text-sm text-muted-foreground">
						Your version is outdated. Download v{minVersion} or later to continue.
					</p>
				</div>
				<a
					href={downloadHref}
					download
					className="inline-flex h-9 items-center justify-center rounded-lg bg-primary px-4 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/80"
				>
					{downloadLabel}
				</a>
				<Link
					href="/trades"
					className="text-sm text-muted-foreground hover:text-foreground transition-colors"
				>
					Back to trades
				</Link>
			</div>
		);
	}

	if (state === "not-installed") {
		return (
			<div className="flex flex-col items-center gap-6 text-center">
				<div className="space-y-2">
					<h2 className="font-heading text-xl font-semibold text-foreground">
						DigSwap Desktop not found
					</h2>
					<p className="text-sm text-muted-foreground">
						Download the desktop app to continue your trade.
					</p>
				</div>
				<a
					href={downloadHref}
					download
					className="inline-flex h-9 items-center justify-center rounded-lg bg-primary px-4 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/80"
				>
					{downloadLabel}
				</a>
				<Link
					href="/trades"
					className="text-sm text-muted-foreground hover:text-foreground transition-colors"
				>
					Learn more about trades
				</Link>
			</div>
		);
	}

	if (state === "success") {
		return (
			<div className="flex flex-col items-center gap-6 text-center">
				<div className="size-12 rounded-full border-2 border-primary animate-pulse bg-primary/10" />
				<div className="space-y-2">
					<h2 className="font-heading text-xl font-semibold text-foreground">
						Opening DigSwap Desktop&hellip;
					</h2>
					<p className="text-sm text-muted-foreground">
						If nothing happened,{" "}
						<button
							type="button"
							onClick={fireProtocolOpen}
							className="text-primary hover:underline"
						>
							try again
						</button>
					</p>
				</div>
			</div>
		);
	}

	// "opening" state (default)
	return (
		<div className="flex flex-col items-center gap-6 text-center">
			<div className="size-12 rounded-full border-2 border-primary/40 border-t-primary animate-spin" />
			<div className="space-y-3">
				<h2 className="font-heading text-xl font-semibold text-foreground">
					Opening DigSwap Desktop&hellip;
				</h2>
				<p className="font-mono text-xs text-muted-foreground break-all max-w-xs">{protocolUrl}</p>
				<p className="text-sm text-muted-foreground">
					Didn&apos;t work?{" "}
					<a href={downloadHref} download className="text-primary hover:underline">
						Download the desktop app
					</a>
				</p>
			</div>
		</div>
	);
}
