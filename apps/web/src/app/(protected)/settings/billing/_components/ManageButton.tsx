"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";

export function ManageButton() {
	const [isPending, startTransition] = useTransition();
	const router = useRouter();

	function handleManage() {
		startTransition(async () => {
			const { createPortalSession } = await import("@/actions/stripe");
			const result = await createPortalSession();
			if ("error" in result) {
				return;
			}
			router.push(result.url);
		});
	}

	return (
		<button
			type="button"
			onClick={handleManage}
			disabled={isPending}
			className="w-full bg-surface-container-low border border-outline-variant text-muted-foreground font-mono text-xs py-3 rounded hover:border-outline transition-colors disabled:opacity-50"
		>
			{isPending ? "..." : "MANAGE_SUBSCRIPTION"}
		</button>
	);
}
