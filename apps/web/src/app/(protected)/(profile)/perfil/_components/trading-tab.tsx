import Link from "next/link";
import type { CollectionItem } from "@/lib/collection/queries";
import { CollectionGrid } from "./collection-grid";

interface TradingTabProps {
	tradeableItems: CollectionItem[];
	activeTradeCount: number;
}

export function TradingTab({ tradeableItems, activeTradeCount }: TradingTabProps) {
	return (
		<div className="space-y-8">
			{/* Tradeable items */}
			<section>
				<div className="flex items-center justify-between mb-4">
					<div className="flex items-center gap-2">
						<span className="material-symbols-outlined text-[16px] text-primary">storefront</span>
						<h3 className="font-mono text-xs text-on-surface-variant uppercase tracking-widest">
							Tradeable
						</h3>
						<span className="font-mono text-[10px] text-primary/60">
							{tradeableItems.length}
						</span>
					</div>
				</div>

				{tradeableItems.length === 0 ? (
					<div className="rounded-xl border border-dashed border-outline-variant/20 p-10 text-center">
						<span className="material-symbols-outlined text-2xl text-on-surface-variant/15 block mb-2">
							swap_horiz
						</span>
						<p className="font-mono text-xs text-on-surface-variant/50">
							No records marked as tradeable yet
						</p>
						<p className="font-mono text-[10px] text-on-surface-variant/30 mt-1">
							Use the visibility selector on your collection cards to mark records as tradeable
						</p>
					</div>
				) : (
					<CollectionGrid items={tradeableItems} isOwner={true} />
				)}
			</section>

			{/* Active trades link */}
			<section className="bg-surface-container-low rounded-xl p-5 border border-outline-variant/5">
				<div className="flex items-center justify-between">
					<div className="flex items-center gap-2">
						<span className="material-symbols-outlined text-[16px] text-secondary">forum</span>
						<h3 className="font-mono text-xs text-on-surface-variant uppercase tracking-widest">
							Active trades
						</h3>
						{activeTradeCount > 0 && (
							<span className="font-mono text-[10px] font-bold bg-secondary/10 text-secondary px-1.5 py-0.5 rounded-full">
								{activeTradeCount}
							</span>
						)}
					</div>
					<Link
						href="/trades"
						className="font-mono text-xs text-primary hover:underline flex items-center gap-1"
					>
						View all
						<span className="material-symbols-outlined text-[14px]">arrow_forward</span>
					</Link>
				</div>
				{activeTradeCount === 0 && (
					<p className="font-mono text-[10px] text-on-surface-variant/40 mt-2">
						No active trades. Find matches on the Radar to start trading.
					</p>
				)}
			</section>
		</div>
	);
}
