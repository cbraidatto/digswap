import Link from "next/link";
import type { SubscriptionPlan } from "@/lib/stripe";

interface Props {
	plan: SubscriptionPlan;
	isPremium: boolean;
	tradesUsed: number;
	tradesLimit: number | null;
	percentUsed: number | null;
}

export function TradeQuotaBanner({ isPremium, tradesUsed, tradesLimit, percentUsed }: Props) {
	if (isPremium) return null;

	const atLimit = tradesUsed >= (tradesLimit ?? 5);

	if (atLimit) {
		return (
			<div className="bg-[#1a0a00] border border-[#c8914a]/40 rounded p-3 flex items-center justify-between gap-3 mb-4">
				<div className="flex items-center gap-2 min-w-0">
					<span className="material-symbols-outlined text-[#c8914a] text-sm flex-shrink-0">
						block
					</span>
					<span className="text-[#c8914a] font-mono text-xs">
						TRADE LIMIT REACHED — {tradesUsed} / {tradesLimit} trades used this month
					</span>
				</div>
				<Link
					href="/pricing"
					className="flex-shrink-0 bg-[#c8914a] text-[#0d0d0d] font-mono text-[10px] font-bold px-2.5 py-1 rounded hover:brightness-110 transition-all"
				>
					UPGRADE
				</Link>
			</div>
		);
	}

	return (
		<div className="bg-[#111008] border border-[#2a2218] rounded p-3 flex items-center gap-3 mb-4">
			<div className="flex-1 min-w-0">
				<div className="flex items-center justify-between mb-1">
					<span className="text-[#4a4035] font-mono text-[10px] uppercase tracking-widest">
						Trades this month
					</span>
					<span className="text-[#7a6e5f] font-mono text-[10px]">
						{tradesUsed} / {tradesLimit}
					</span>
				</div>
				<div className="h-1 bg-[#1a1610] rounded-full overflow-hidden">
					<div
						className="h-full bg-[#c8914a] rounded-full"
						style={{ width: `${Math.min(percentUsed ?? 0, 100)}%` }}
					/>
				</div>
			</div>
			<Link
				href="/pricing"
				className="flex-shrink-0 text-[#4a4035] hover:text-[#c8914a] font-mono text-[10px] transition-colors"
			>
				Upgrade
			</Link>
		</div>
	);
}
