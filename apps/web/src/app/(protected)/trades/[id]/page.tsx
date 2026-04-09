import { eq } from "drizzle-orm";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { markTradeThreadRead } from "@/actions/trade-messages";
import { db } from "@/lib/db";
import { profiles } from "@/lib/db/schema/users";
import { createClient } from "@/lib/supabase/server";
import { getTradeParticipantContext, getTradeThread } from "@/lib/trades/messages";
import { deriveTradePresence } from "@/lib/trades/presence";
import { getProposalHistory } from "@/lib/trades/proposal-queries";
import { ProposalActionBar } from "./_components/ProposalActionBar";
import { ProposalHistoryThread } from "./_components/ProposalHistoryThread";
import { TradeActionButtons } from "./_components/TradeActionButtons";
import { TradeDetailHeader } from "./_components/TradeDetailHeader";
import { TradeMessageComposer } from "./_components/TradeMessageComposer";
import { TradeMessageThread } from "./_components/TradeMessageThread";
import { TradePresenceIndicator } from "./_components/TradePresenceIndicator";
import { TradeReviewForm } from "./_components/TradeReviewForm";

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

	let thread: Awaited<ReturnType<typeof getTradeThread>>;
	let participantContext: Awaited<ReturnType<typeof getTradeParticipantContext>>;
	let proposalHistory: Awaited<ReturnType<typeof getProposalHistory>>;
	let currentProfile: { username: string | null; avatarUrl: string | null } | undefined;
	try {
		[thread, participantContext, proposalHistory, currentProfile] = await Promise.all([
			getTradeThread(id, user.id),
			getTradeParticipantContext(id, user.id),
			getProposalHistory(id, user.id),
			db
				.select({ username: profiles.username, avatarUrl: profiles.avatarUrl })
				.from(profiles)
				.where(eq(profiles.id, user.id))
				.limit(1)
				.then((rows) => rows[0]),
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

			{/* Trade action buttons (accept/decline/cancel) — legacy flow */}
			<div className="mb-4">
				<TradeActionButtons
					tradeId={thread.tradeId}
					status={thread.status}
					isProvider={isProvider}
				/>
			</div>

			{/* Proposal history thread — shown only for trades with proposals */}
			{proposalHistory.length > 0 && (
				<div className="mb-4">
					<ProposalHistoryThread
						proposals={proposalHistory}
						currentUserId={user.id}
						counterpartyUsername={thread.counterpartyUsername}
						counterpartyAvatarUrl={thread.counterpartyAvatarUrl}
						currentUserUsername={currentProfile?.username ?? "You"}
						currentUserAvatarUrl={currentProfile?.avatarUrl ?? null}
					/>
				</div>
			)}

			{/* Proposal action bar — accept/decline/counter for pending proposal */}
			{(() => {
				const pendingProposal = proposalHistory.findLast(
					(p) => p.status === "pending",
				);
				if (!pendingProposal) return null;
				return (
					<div className="mb-4">
						<ProposalActionBar
							proposal={pendingProposal}
							tradeId={thread.tradeId}
							currentUserId={user.id}
							counterpartyId={thread.counterpartyId}
						/>
					</div>
				);
			})()}

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
