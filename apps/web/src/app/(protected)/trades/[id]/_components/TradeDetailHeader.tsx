import type { TradeThreadDetail } from "@/lib/trades/messages";

const TERMINAL_STATUSES = new Set(["completed", "declined", "cancelled", "expired"]);

const STATUS_CONFIG: Record<string, { label: string; dot: string; text: string }> = {
	pending:     { label: "PENDING",     dot: "bg-[#4a4035]",  text: "text-[#4a4035]" },
	lobby:       { label: "LOBBY",       dot: "bg-[#c8914a]",  text: "text-[#c8914a]" },
	previewing:  { label: "PREVIEWING",  dot: "bg-[#c8914a]",  text: "text-[#c8914a]" },
	accepted:    { label: "ACCEPTED",    dot: "bg-[#c8914a]",  text: "text-[#c8914a]" },
	transferring:{ label: "TRANSFERRING",dot: "bg-[#7aa2c8]",  text: "text-[#7aa2c8]" },
	completed:   { label: "COMPLETE",    dot: "bg-[#7ac87a]",  text: "text-[#7ac87a]" },
	declined:    { label: "DECLINED",    dot: "bg-[#4a4035]",  text: "text-[#4a4035]" },
	cancelled:   { label: "CANCELLED",   dot: "bg-[#4a4035]",  text: "text-[#4a4035]" },
	expired:     { label: "EXPIRED",     dot: "bg-[#4a4035]",  text: "text-[#4a4035]" },
};

interface Props {
	thread: TradeThreadDetail;
}

export function TradeDetailHeader({ thread }: Props) {
	const status = STATUS_CONFIG[thread.status] ?? STATUS_CONFIG.pending;
	const isTerminal = TERMINAL_STATUSES.has(thread.status);

	return (
		<div className="border-b border-[#2a2218] pb-5 mb-6">
			{/* Status row */}
			<div className="flex items-center gap-2 mb-4">
				<span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${status.dot}`} />
				<span className={`font-mono text-[10px] uppercase tracking-widest ${status.text}`}>
					{status.label}
				</span>
			</div>

			{/* Counterparty card */}
			<div className="flex items-center gap-3 mb-5">
				{thread.counterpartyAvatarUrl ? (
					<img
						src={thread.counterpartyAvatarUrl}
						alt=""
						className="w-10 h-10 rounded-full border border-[#2a2218]"
					/>
				) : (
					<div className="w-10 h-10 rounded-full bg-[#1a1610] border border-[#2a2218] flex items-center justify-center">
						<span className="text-[#7a6e5f] text-sm font-mono">
							{(thread.counterpartyUsername[0] ?? "?").toUpperCase()}
						</span>
					</div>
				)}
				<div>
					<p className="text-[#e8dcc8] font-mono text-sm font-medium">
						{thread.counterpartyUsername}
					</p>
					<p className="text-[#4a4035] font-mono text-[10px] uppercase tracking-widest">
						Counterparty
					</p>
				</div>
			</div>

			{/* Open in Desktop CTA */}
			{!isTerminal && (
				<a
					href={`digswap://trade/${thread.tradeId}`}
					className="inline-flex items-center gap-2 bg-[#c8914a] hover:bg-[#e8a85a] text-[#0d0d0d] font-mono text-xs font-bold px-4 py-2 rounded transition-colors"
				>
					<span className="material-symbols-outlined text-sm">open_in_new</span>
					Open in Desktop
				</a>
			)}
		</div>
	);
}
