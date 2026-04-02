"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";

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
			onClick={handleManage}
			disabled={isPending}
			className="w-full bg-[#1a1610] border border-[#2a2218] text-[#7a6e5f] font-mono text-xs py-3 rounded hover:border-[#3a3228] transition-colors disabled:opacity-50"
		>
			{isPending ? "..." : "MANAGE_SUBSCRIPTION"}
		</button>
	);
}
