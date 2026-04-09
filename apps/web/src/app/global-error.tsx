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
	}, [error]);

	return (
		<html lang="en">
			<body>
				<div
					style={{
						padding: "2rem",
						fontFamily: "monospace",
						color: "#e8dcc8",
						background: "#0d0d0d",
						minHeight: "100vh",
						display: "flex",
						flexDirection: "column",
						alignItems: "center",
						justifyContent: "center",
					}}
				>
					<h2 style={{ fontSize: "1.5rem", marginBottom: "1rem" }}>Something went wrong</h2>
					<button
						type="button"
						onClick={reset}
						style={{
							padding: "0.5rem 1rem",
							background: "#c8914a",
							color: "#0d0d0d",
							border: "none",
							borderRadius: "4px",
							cursor: "pointer",
							fontFamily: "monospace",
						}}
					>
						Try again
					</button>
				</div>
			</body>
		</html>
	);
}
