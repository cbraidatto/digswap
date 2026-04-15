import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = {
	title: "Trades — DigSwap",
	description: "Manage your vinyl trade requests and active swaps.",
};

import { TradeQuotaBanner } from "@/components/trades/TradeQuotaBanner";
import { getQuotaStatus } from "@/lib/entitlements";
import { listTradeThreads, type TradeThreadListItem } from "@/lib/trades/messages";

const TERMINAL_STATUSES = new Set(["completed", "declined", "cancelled", "expired"]);

const STATUS_LABEL: Record<string, { label: string; className: string }> = {
	pending: { label: "Pending", className: "text-muted-foreground border-outline-variant" },
	lobby: { label: "Upload Files", className: "text-amber-400 border-amber-400/40 bg-amber-400/10" },
	previewing: { label: "Previewing", className: "text-primary border-primary/30" },
	accepted: { label: "Accepted", className: "text-primary border-primary/30" },
	transferring: { label: "Transferring", className: "text-secondary border-secondary/30" },
	completed: { label: "Complete", className: "text-tertiary border-tertiary/30" },
	declined: { label: "Declined", className: "text-muted-foreground border-outline-variant" },
	cancelled: { label: "Cancelled", className: "text-muted-foreground border-outline-variant" },
	expired: { label: "Expired", className: "text-muted-foreground border-outline-variant" },
};

function formatRelativeTime(iso: string) {
	const diff = Date.now() - new Date(iso).getTime();
	const mins = Math.floor(diff / 60_000);
	if (mins < 1) return "just now";
	if (mins < 60) return `${mins}m ago`;
	const hrs = Math.floor(mins / 60);
	if (hrs < 24) return `${hrs}h ago`;
	return `${Math.floor(hrs / 24)}d ago`;
}

function TradeCard({ thread }: { thread: TradeThreadListItem }) {
	const status = STATUS_LABEL[thread.status] ?? STATUS_LABEL.pending;
	const isTerminal = TERMINAL_STATUSES.has(thread.status);
	const timestamp = thread.lastMessage?.createdAt ?? thread.updatedAt;

	return (
		<Link
			href={`/trades/${thread.tradeId}`}
			className={`block bg-surface-container-lowest border border-outline-variant rounded p-4 hover:border-outline transition-colors ${isTerminal ? "opacity-60" : ""}`}
		>
			<div className="flex items-start justify-between gap-3 mb-2">
				<div className="flex items-center gap-2 min-w-0">
					{thread.counterpartyAvatarUrl ? (
						<Image
							src={thread.counterpartyAvatarUrl}
							alt=""
							width={28}
							height={28}
							unoptimized
							className="w-7 h-7 rounded-full flex-shrink-0 border border-outline-variant"
						/>
					) : (
						<div className="w-7 h-7 rounded-full bg-surface-container-low border border-outline-variant flex-shrink-0 flex items-center justify-center">
							<span className="text-muted-foreground text-xs">
								{(thread.counterpartyUsername[0] ?? "?").toUpperCase()}
							</span>
						</div>
					)}
					<span className="text-foreground text-sm truncate">{thread.counterpartyUsername}</span>
				</div>

				<div className="flex items-center gap-2 flex-shrink-0">
					{thread.unreadCount > 0 && (
						<span className="bg-primary text-primary-foreground text-xs font-bold px-1.5 py-0.5 rounded-full">
							{thread.unreadCount}
						</span>
					)}
					{thread.pendingProposalForMe && (
						<span className="bg-secondary/10 text-secondary border border-secondary/30 text-xs px-1.5 py-0.5 rounded">
							Counter needed
						</span>
					)}
					<span className={`text-xs px-1.5 py-0.5 rounded border ${status.className}`}>
						{status.label}
					</span>
				</div>
			</div>

			<div className="flex items-end justify-between gap-2">
				<p className="text-muted-foreground text-xs truncate flex-1">
					{thread.lastMessage
						? thread.lastMessage.body
						: thread.pendingProposalForMe
							? "New proposal waiting for your response"
							: "No messages yet"}
				</p>
				<span className="text-muted-foreground/60 text-xs flex-shrink-0">
					{formatRelativeTime(timestamp)}
				</span>
			</div>
		</Link>
	);
}

export default async function TradesPage() {
	const supabase = await createClient();
	const {
		data: { user },
	} = await supabase.auth.getUser();
	if (!user) redirect("/signin");

	const [threads, quota] = await Promise.all([listTradeThreads(user.id), getQuotaStatus(user.id)]);

	return (
		<div className="max-w-2xl mx-auto px-4 py-8">
			<TradeQuotaBanner
				plan={quota.plan}
				isPremium={quota.isPremium}
				tradesUsed={quota.tradesUsed}
				tradesLimit={quota.tradesLimit}
				percentUsed={quota.percentUsed}
			/>
			<div className="mb-6">
				<h1 className="text-foreground font-heading text-xl font-bold tracking-tight">Trades</h1>
				<p className="text-muted-foreground text-xs mt-1">
					{threads.length} active trade{threads.length !== 1 ? "s" : ""}
				</p>
			</div>

			{threads.length === 0 ? (
				<div className="text-center py-16 border border-dashed border-outline-variant rounded">
					<p className="text-muted-foreground text-sm">No active trades</p>
					<p className="text-muted-foreground/50 text-xs mt-2">
						Discover records to trade on{" "}
						<Link href="/radar" className="text-primary hover:underline">
							The Radar
						</Link>
					</p>
				</div>
			) : (
				<div className="flex flex-col gap-2">
					{threads.map((thread) => (
						<TradeCard key={thread.tradeId} thread={thread} />
					))}
				</div>
			)}
		</div>
	);
}
