/**
 * Public handoff page for web→desktop protocol redirect.
 *
 * Route: GET /desktop/open?trade=<tradeId>&token=<plaintextToken>
 *
 * This page is intentionally outside the (protected) group — it must be
 * accessible before the user is fully authenticated in the web app, since
 * the handoff token itself is the auth credential for the desktop app.
 *
 * Flow:
 * 1. Web app calls generateHandoffToken, redirects here with trade+token params
 * 2. This page checks the min desktop version gate
 * 3. Passes params to <OpenInDesktop> client component
 * 4. Client component fires digswap:// protocol handler on mount
 *
 * See: ADR-002-desktop-trade-runtime.md D-08
 */

import type { Metadata } from "next";
import { checkDesktopVersion } from "@/actions/desktop";
import { OpenInDesktop } from "./_components/open-in-desktop";

export const metadata: Metadata = {
	title: "Opening DigSwap Desktop | DigSwap",
	description: "Launching the DigSwap desktop app for your trade.",
	robots: { index: false, follow: false },
};

interface PageProps {
	searchParams: Promise<{
		trade?: string;
		token?: string;
		/** Optional: desktop version reported back in the URL for version gate */
		dv?: string;
	}>;
}

export default async function DesktopOpenPage({ searchParams }: PageProps) {
	const params = await searchParams;
	const tradeId = params.trade ?? "";
	const token = params.token ?? "";
	const desktopVersion = params.dv?.trim() || undefined;

	const { minVersion, tradeProtocolVersion } = await checkDesktopVersion();

	return (
		<div className="flex min-h-dvh flex-col items-center justify-center bg-background px-4 py-8">
			{/* Header */}
			<div className="mb-10 text-center">
				<h1 className="font-heading text-[28px] font-normal tracking-[-0.03em] leading-[1.1] text-foreground sm:text-[36px]">
					Dig<span className="text-primary">Swap</span>
				</h1>
				<p className="mt-1 text-sm text-muted-foreground font-mono">Desktop Trade Runtime</p>
			</div>

			{/* Handoff card */}
			<div className="w-full max-w-md rounded-lg border border-border bg-card p-8">
				{!tradeId || !token ? (
					// Malformed URL — missing required params
					<div className="flex flex-col items-center gap-4 text-center">
						<h2 className="font-heading text-xl font-semibold text-foreground">
							Invalid handoff link
						</h2>
						<p className="text-sm text-muted-foreground">
							This link is missing required parameters. Please return to the trade and click
							&ldquo;Open in Desktop App&rdquo; again.
						</p>
					</div>
				) : (
					<OpenInDesktop
						tradeId={tradeId}
						token={token}
						tradeProtocolVersion={tradeProtocolVersion}
						minVersion={minVersion}
						desktopVersion={desktopVersion}
					/>
				)}
			</div>
		</div>
	);
}
