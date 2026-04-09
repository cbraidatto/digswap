"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTransition } from "react";

interface Props {
	open: boolean;
	onClose: () => void;
	tradesUsed: number;
	tradesLimit?: number;
}

export function TradeLimitModal({ open, onClose, tradesUsed, tradesLimit = 5 }: Props) {
	const [isPending, startTransition] = useTransition();
	const router = useRouter();

	if (!open) return null;

	function handleUpgrade() {
		startTransition(async () => {
			const { createCheckoutSession } = await import("@/actions/stripe");
			try {
				const priceId = process.env.NEXT_PUBLIC_STRIPE_PRICE_MONTHLY ?? "";
				const result = await createCheckoutSession(priceId);
				if ("error" in result) {
					router.push("/pricing");
					return;
				}
				router.push(result.url);
			} catch {
				// Fallback to pricing page if action fails
				router.push("/pricing");
			}
		});
	}

	return (
		// biome-ignore lint/a11y/useKeyWithClickEvents: backdrop dismiss pattern
		// biome-ignore lint/a11y/noStaticElementInteractions: backdrop dismiss pattern
		<div
			className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
			onClick={onClose}
		>
			{/* biome-ignore lint/a11y/useKeyWithClickEvents: stopPropagation prevents backdrop dismiss */}
			{/* biome-ignore lint/a11y/noStaticElementInteractions: modal content wrapper */}
			<div
				className="bg-[#111008] border border-[#c8914a]/30 rounded w-full max-w-sm p-6 space-y-4"
				onClick={(e) => e.stopPropagation()}
			>
				{/* Header */}
				<div className="flex items-start gap-3">
					<span className="material-symbols-outlined text-[#c8914a] flex-shrink-0">album</span>
					<div>
						<div className="text-[#e8dcc8] font-mono text-sm font-bold">MONTHLY LIMIT REACHED</div>
						<div className="text-[#4a4035] font-mono text-xs mt-0.5">
							{tradesUsed} / {tradesLimit} trades this month
						</div>
					</div>
				</div>

				<p className="text-[#7a6e5f] font-mono text-xs leading-relaxed">
					You've used all {tradesLimit} trades this month. Upgrade to Premium for unlimited trades
					and exclusive digger tools.
				</p>

				<div className="flex flex-col gap-2">
					<button
						type="button"
						onClick={handleUpgrade}
						disabled={isPending}
						className="w-full bg-[#c8914a] text-[#0d0d0d] font-mono text-xs font-bold py-2.5 rounded hover:brightness-110 transition-all disabled:opacity-50"
					>
						{isPending ? "..." : "Upgrade to Premium"}
					</button>
					<Link
						href="/pricing"
						className="w-full block text-center text-[#4a4035] hover:text-[#7a6e5f] font-mono text-xs py-2 transition-colors"
					>
						See all plans
					</Link>
					<button
						type="button"
						onClick={onClose}
						className="w-full text-[#2a2218] hover:text-[#4a4035] font-mono text-xs py-1 transition-colors"
					>
						CLOSE
					</button>
				</div>
			</div>
		</div>
	);
}
