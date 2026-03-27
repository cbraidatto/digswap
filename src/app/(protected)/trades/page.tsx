import { createClient } from "@/lib/supabase/server";
import { getTradeInbox } from "@/lib/trades/queries";
import { getTradeCountThisMonth } from "@/lib/trades/queries";
import { MAX_FREE_TRADES_PER_MONTH } from "@/lib/trades/constants";
import { TradeInbox } from "./_components/trade-inbox";
import { TradeQuotaCounter } from "./_components/trade-quota-counter";

export default async function TradesPage() {
	const supabase = await createClient();
	const {
		data: { user },
	} = await supabase.auth.getUser();

	if (!user) {
		return null;
	}

	// Fetch initial trade data for the pending tab
	const initialTrades = await getTradeInbox(user.id, "pending");

	// Fetch trade count for quota display
	const tradeCount = await getTradeCountThisMonth(user.id);

	// Fetch counts for all tabs
	const [pendingTrades, activeTrades, completedTrades] = await Promise.all([
		getTradeInbox(user.id, "pending"),
		getTradeInbox(user.id, "active"),
		getTradeInbox(user.id, "completed"),
	]);

	const tabCounts = {
		pending: pendingTrades.length,
		active: activeTrades.length,
		completed: completedTrades.length,
	};

	return (
		<div className="max-w-4xl mx-auto px-4 md:px-8 py-8">
			{/* Header */}
			<div className="mb-8">
				<span className="text-[10px] font-mono text-primary tracking-[0.2em] uppercase">
					Protocol / Trades
				</span>
				<h1 className="text-3xl font-bold font-heading text-on-surface mt-1 uppercase">
					TRADE_INBOX
				</h1>
				<p className="text-xs font-mono text-on-surface-variant mt-2">
					Manage your P2P audio exchanges.
				</p>
			</div>

			{/* Quota counter */}
			<div className="mb-6">
				<TradeQuotaCounter
					count={tradeCount.count}
					total={MAX_FREE_TRADES_PER_MONTH}
					plan={tradeCount.plan}
				/>
			</div>

			{/* Trade inbox with tabs */}
			<TradeInbox
				initialTrades={initialTrades}
				initialTab="pending"
				tabCounts={tabCounts}
			/>
		</div>
	);
}
