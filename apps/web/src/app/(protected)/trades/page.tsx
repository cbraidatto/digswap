import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { listTradeThreads, type TradeThreadListItem } from "@/lib/trades/messages";

const TERMINAL_STATUSES = new Set(["completed", "declined", "cancelled", "expired"]);

const STATUS_LABEL: Record<string, { label: string; className: string }> = {
	pending:     { label: "PENDING",     className: "text-[#4a4035] border-[#2a2218]" },
	lobby:       { label: "LOBBY",       className: "text-[#c8914a] border-[#c8914a]/30" },
	previewing:  { label: "PREVIEWING",  className: "text-[#c8914a] border-[#c8914a]/30" },
	accepted:    { label: "ACCEPTED",    className: "text-[#c8914a] border-[#c8914a]/30" },
	transferring:{ label: "TRANSFERRING",className: "text-[#7aa2c8] border-[#7aa2c8]/30" },
	completed:   { label: "COMPLETE",    className: "text-[#7ac87a] border-[#7ac87a]/30" },
	declined:    { label: "DECLINED",    className: "text-[#4a4035] border-[#2a2218]" },
	cancelled:   { label: "CANCELLED",   className: "text-[#4a4035] border-[#2a2218]" },
	expired:     { label: "EXPIRED",     className: "text-[#4a4035] border-[#2a2218]" },
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
			className={`block bg-[#0d0d0d] border border-[#2a2218] rounded p-4 hover:border-[#3a3228] transition-colors ${isTerminal ? "opacity-60" : ""}`}
		>
			<div className="flex items-start justify-between gap-3 mb-2">
				<div className="flex items-center gap-2 min-w-0">
					{thread.counterpartyAvatarUrl ? (
						<img
							src={thread.counterpartyAvatarUrl}
							alt=""
							className="w-7 h-7 rounded-full flex-shrink-0 border border-[#2a2218]"
						/>
					) : (
						<div className="w-7 h-7 rounded-full bg-[#1a1610] border border-[#2a2218] flex-shrink-0 flex items-center justify-center">
							<span className="text-[#4a4035] text-xs font-mono">
								{(thread.counterpartyUsername[0] ?? "?").toUpperCase()}
							</span>
						</div>
					)}
					<span className="text-[#e8dcc8] text-sm font-mono truncate">
						{thread.counterpartyUsername}
					</span>
				</div>

				<div className="flex items-center gap-2 flex-shrink-0">
					{thread.unreadCount > 0 && (
						<span className="bg-[#c8914a] text-[#0d0d0d] text-[10px] font-mono font-bold px-1.5 py-0.5 rounded-full">
							{thread.unreadCount}
						</span>
					)}
					<span className={`text-[10px] font-mono px-1.5 py-0.5 rounded border ${status.className}`}>
						{status.label}
					</span>
				</div>
			</div>

			<div className="flex items-end justify-between gap-2">
				<p className="text-[#7a6e5f] text-xs font-mono truncate flex-1">
					{thread.lastMessage
						? thread.lastMessage.body
						: "No messages yet"}
				</p>
				<span className="text-[#4a4035] text-[10px] font-mono flex-shrink-0">
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

	const threads = await listTradeThreads(user.id);

	return (
		<div className="max-w-2xl mx-auto px-4 py-8">
			<div className="mb-6">
				<h1 className="text-[#e8dcc8] font-heading text-xl font-bold tracking-tight">
					Trades
				</h1>
				<p className="text-[#4a4035] text-xs font-mono mt-1">
					{threads.length} active trade{threads.length !== 1 ? "s" : ""}
				</p>
			</div>

			{threads.length === 0 ? (
				<div className="text-center py-16 border border-dashed border-[#2a2218] rounded">
					<p className="text-[#4a4035] font-mono text-sm">No active trades</p>
					<p className="text-[#2a2218] font-mono text-xs mt-2">
						Discover records to trade on{" "}
						<Link href="/radar" className="text-[#c8914a] hover:underline">
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
