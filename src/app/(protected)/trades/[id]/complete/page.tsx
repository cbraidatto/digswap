import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getTradeById } from "@/lib/trades/queries";
import { CONTRIBUTION_POINTS } from "@/lib/gamification/constants";
import { TradeRatingForm } from "./_components/trade-rating-form";

interface TradeCompletePageProps {
	params: Promise<{ id: string }>;
}

export default async function TradeCompletePage({ params }: TradeCompletePageProps) {
	const { id: tradeId } = await params;

	// Auth check
	const supabase = await createClient();
	const {
		data: { user },
	} = await supabase.auth.getUser();

	if (!user) redirect("/signin");

	// Fetch trade, verify participant
	const trade = await getTradeById(tradeId, user.id);
	if (!trade) redirect("/trades");

	// Determine counterparty
	const counterpartyUsername = trade.counterpartyUsername ?? "unknown";

	return (
		<div className="max-w-2xl mx-auto px-4 md:px-8 py-16 flex flex-col items-center text-center">
			{/* Success animation area */}
			<div className="relative mb-8">
				<div className="w-24 h-24 rounded-full bg-primary-container/20 border-2 border-primary flex items-center justify-center">
					<span className="material-symbols-outlined text-primary text-5xl">merge</span>
				</div>
				{/* Radial glow */}
				<div className="absolute inset-0 bg-primary/10 blur-2xl rounded-full pointer-events-none" />
			</div>

			<div className="mb-2">
				<span className="text-[10px] font-mono text-primary uppercase tracking-[0.3em]">
					STATUS / MERGED
				</span>
			</div>
			<h1 className="text-4xl font-bold font-heading text-on-surface mb-4 uppercase">
				TRADE_COMPLETE
			</h1>
			<p className="text-on-surface-variant font-sans text-sm mb-8 max-w-md">
				The P2P transfer was successful. Both parties have received the audio files.
				Rate the quality of the file you received to update the sharer&apos;s reputation.
			</p>

			{/* Trade summary */}
			<div className="w-full bg-surface-container-low rounded-xl p-6 mb-8 text-left border border-outline-variant/10">
				<h2 className="text-xs font-mono uppercase tracking-widest text-on-surface-variant mb-4">
					Trade_Summary
				</h2>
				<div className="space-y-2 font-mono text-xs">
					<div className="flex justify-between">
						<span className="text-on-surface-variant">TRADE_ID</span>
						<span className="text-primary">vnl-#{trade.id.substring(0, 3)}</span>
					</div>
					<div className="flex justify-between">
						<span className="text-on-surface-variant">COUNTERPARTY</span>
						<span className="text-secondary">{counterpartyUsername}</span>
					</div>
					<div className="flex justify-between">
						<span className="text-on-surface-variant">FILES_TRANSFERRED</span>
						<span className="text-primary">[CONFIRMED]</span>
					</div>
					<div className="flex justify-between">
						<span className="text-on-surface-variant">CONTRIBUTION</span>
						<span className="text-tertiary">+{CONTRIBUTION_POINTS.trade_completed} pts</span>
					</div>
				</div>
			</div>

			{/* Rating Form */}
			<TradeRatingForm
				tradeId={trade.id}
				counterpartyUsername={counterpartyUsername}
			/>
		</div>
	);
}
