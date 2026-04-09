"use client";

import { useEffect } from "react";

export default function SettingsError({
	error,
	reset,
}: {
	error: Error & { digest?: string };
	reset: () => void;
}) {
	useEffect(() => {
		console.error("[DigSwap] Settings error:", error);
	}, [error]);

	return (
		<div className="min-h-[50vh] flex items-center justify-center p-6">
			<div className="w-full max-w-sm text-center">
				<div className="w-14 h-14 mx-auto mb-5 rounded-full bg-destructive/10 flex items-center justify-center">
					<span className="material-symbols-outlined text-2xl text-destructive">error</span>
				</div>
				<h2 className="font-heading text-xl font-bold text-foreground mb-2">
					Could not load settings
				</h2>
				<p className="text-muted-foreground text-sm mb-5">
					Something went wrong loading your settings. Please try again.
				</p>
				<button
					type="button"
					onClick={reset}
					className="w-full bg-primary text-primary-foreground font-medium py-2.5 rounded-md text-sm hover:brightness-110 transition-all"
				>
					Try again
				</button>
			</div>
		</div>
	);
}
