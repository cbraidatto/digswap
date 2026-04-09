"use client";

import * as Sentry from "@sentry/nextjs";
import { useEffect } from "react";

export default function GlobalError({
	error,
	reset,
}: {
	error: Error & { digest?: string };
	reset: () => void;
}) {
	useEffect(() => {
		Sentry.captureException(error);
		// SECURITY: Only log error message in production, not full stack trace
		if (process.env.NODE_ENV === "development") {
			console.error("[DigSwap] Unhandled error:", error);
		}
	}, [error]);

	return (
		<div className="min-h-screen flex items-center justify-center p-6 bg-background">
			<div className="w-full max-w-md text-center">
				<div className="w-16 h-16 mx-auto mb-6 rounded-full bg-destructive/10 flex items-center justify-center">
					<span className="material-symbols-outlined text-3xl text-destructive">error</span>
				</div>

				<h1 className="font-heading text-2xl font-bold text-foreground mb-2">
					Something went wrong
				</h1>
				<p className="text-muted-foreground text-sm mb-6">
					An unexpected error occurred. You can try again or go back to the home page.
				</p>

				{/* SECURITY: error.digest hidden in production to prevent information disclosure */}

				<div className="flex flex-col gap-3">
					<button
						type="button"
						onClick={reset}
						className="w-full bg-primary text-primary-foreground font-medium py-3 rounded-md text-sm hover:brightness-110 transition-all"
					>
						Try again
					</button>
					<a
						href="/"
						className="w-full bg-surface-container text-on-surface-variant font-medium py-3 rounded-md text-sm hover:bg-surface-container-high transition-all inline-block"
					>
						Back to home
					</a>
				</div>
			</div>
		</div>
	);
}
