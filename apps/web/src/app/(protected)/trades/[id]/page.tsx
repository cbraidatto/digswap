import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { getTradeThread, getTradeParticipantContext } from "@/lib/trades/messages";
import { deriveTradePresence } from "@/lib/trades/presence";
import { markTradeThreadRead } from "@/actions/trade-messages";
import { TradeDetailHeader } from "./_components/TradeDetailHeader";
import { TradeActionButtons } from "./_components/TradeActionButtons";
import { TradeReviewForm } from "./_components/TradeReviewForm";
import { TradeMessageThread } from "./_components/TradeMessageThread";
import { TradeMessageComposer } from "./_components/TradeMessageComposer";
import { TradePresenceIndicator } from "./_components/TradePresenceIndicator";

export const metadata: Metadata = {
	title: "Trade — DigSwap",
	description: "View trade details and messages with another digger.",
};

interface Props {
	params: Promise<{ id: string }>;
}

export default async function TradeDetailPage({ params }: Props) {
	const { id } = await params;

	const supabase = await createClient();
	const {
		data: { user },
	} = await supabase.auth.getUser();
	if (!user) redirect("/signin");

	let thread;
	let participantContext;
	try {
		[thread, participantContext] = await Promise.all([
			getTradeThread(id, user.id),
			getTradeParticipantContext(id, user.id),
		]);
	} catch {
		notFound();
	}

	if (!thread || !participantContext) notFound();

	const isProvider = !participantContext.isRequester;

	// Presence — best-effort, never block render
	const presence = await deriveTradePresence(id, user.id).catch(() => null);

	// Mark thread as read on load — fire and forget
	void markTradeThreadRead(id).catch(() => undefined);

	return (
		<div className="max-w-2xl mx-auto px-4 py-8">
			{/* Back nav */}
			<Link
				href="/trades"
				className="inline-flex items-center gap-1.5 text-muted-foreground hover:text-muted-foreground font-mono text-xs mb-6 transition-colors"
			>
				<span className="material-symbols-outlined text-sm">arrow_back</span>
				Trades
			</Link>

			<TradeDetailHeader thread={thread} />

			{/* Trade action buttons (accept/decline/cancel) */}
			<div className="mb-4">
				<TradeActionButtons
					tradeId={thread.tradeId}
					status={thread.status}
					isProvider={isProvider}
				/>
			</div>

			{/* Presence indicator */}
			{presence && (
				<div className="mb-4">
					<TradePresenceIndicator
						tradeId={thread.tradeId}
						userId={user.id}
						counterpartyId={thread.counterpartyId}
						initialState={presence.state}
					/>
				</div>
			)}

			<div className="min-h-[300px]">
				<TradeMessageThread
					messages={thread.messages}
					tradeId={thread.tradeId}
					currentUserId={user.id}
					counterpartyUsername={thread.counterpartyUsername}
					counterpartyAvatarUrl={thread.counterpartyAvatarUrl}
				/>
			</div>

			<TradeMessageComposer tradeId={thread.tradeId} status={thread.status} />

			{/* Trade review form — shown only for completed trades */}
			<TradeReviewForm tradeId={thread.tradeId} status={thread.status} />
		</div>
	);
}
