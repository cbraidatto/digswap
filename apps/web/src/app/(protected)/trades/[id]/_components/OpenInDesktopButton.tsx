"use client";

import { useState } from "react";
import { generateHandoffToken } from "@/actions/desktop";

interface DesktopShellBridge {
	getAppVersion(): Promise<string>;
}

function getDesktopShell() {
	return (window as Window & { desktopShell?: DesktopShellBridge }).desktopShell;
}

interface Props {
	tradeId: string;
}

export function OpenInDesktopButton({ tradeId }: Props) {
	const [errorMessage, setErrorMessage] = useState<string | null>(null);
	const [isPending, setIsPending] = useState(false);

	// Already inside the desktop app — don't show this button
	if (typeof window !== "undefined" && getDesktopShell()) return null;

	async function handleOpen() {
		if (isPending) return;

		setIsPending(true);
		setErrorMessage(null);

		try {
			const desktopVersion = await getDesktopShell()
				?.getAppVersion()
				.catch(() => null);
			const result = await generateHandoffToken(tradeId);
			if ("error" in result) {
				setErrorMessage(result.error);
				return;
			}

			const params = new URLSearchParams({
				token: result.token,
				trade: tradeId,
			});

			if (desktopVersion) {
				params.set("dv", desktopVersion);
			}

			window.location.assign(`/desktop/open?${params.toString()}`);
		} finally {
			setIsPending(false);
		}
	}

	return (
		<div className="flex flex-col gap-2">
			<button
				type="button"
				onClick={handleOpen}
				disabled={isPending}
				className="inline-flex items-center gap-2 bg-primary hover:bg-primary text-background font-mono text-xs font-bold px-4 py-2 rounded transition-colors disabled:cursor-not-allowed disabled:opacity-60"
			>
				<span className="material-symbols-outlined text-sm">open_in_new</span>
				{isPending ? "Opening…" : "Open in Desktop"}
			</button>
			{errorMessage ? <p className="text-xs text-destructive font-mono">{errorMessage}</p> : null}
		</div>
	);
}
