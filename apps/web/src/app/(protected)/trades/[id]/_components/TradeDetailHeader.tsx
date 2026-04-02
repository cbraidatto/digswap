import type { TradeThreadDetail } from "@/lib/trades/messages";

const TERMINAL_STATUSES = new Set(["completed", "declined", "cancelled", "expired"]);

const STATUS_CONFIG: Record<string, { label: string; dot: string; text: string }> = {
	pending:     { label: "PENDING",     dot: "bg-muted-foreground",  text: "text-muted-foreground" },
	lobby:       { label: "LOBBY",       dot: "bg-primary",  text: "text-primary" },
	previewing:  { label: "PREVIEWING",  dot: "bg-primary",  text: "text-primary" },
	accepted:    { label: "ACCEPTED",    dot: "bg-primary",  text: "text-primary" },
	transferring:{ label: "TRANSFERRING",dot: "bg-secondary",  text: "text-secondary" },
	completed:   { label: "COMPLETE",    dot: "bg-tertiary",  text: "text-tertiary" },
	declined:    { label: "DECLINED",    dot: "bg-muted-foreground",  text: "text-muted-foreground" },
	cancelled:   { label: "CANCELLED",   dot: "bg-muted-foreground",  text: "text-muted-foreground" },
	expired:     { label: "EXPIRED",     dot: "bg-muted-foreground",  text: "text-muted-foreground" },
};

interface Props {
	thread: TradeThreadDetail;
}

export function TradeDetailHeader({ thread }: Props) {
	const status = STATUS_CONFIG[thread.status] ?? STATUS_CONFIG.pending;
	const isTerminal = TERMINAL_STATUSES.has(thread.status);

	return (
		<div className="border-b border-outline-variant pb-5 mb-6">
			{/* Status row */}
			<div className="flex items-center gap-2 mb-4">
				<span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${status.dot}`} />
				<span className={`font-mono text-xs uppercase tracking-widest ${status.text}`}>
					{status.label}
				</span>
			</div>

			{/* Counterparty card */}
			<div className="flex items-center gap-3 mb-5">
				{thread.counterpartyAvatarUrl ? (
					<img
						src={thread.counterpartyAvatarUrl}
						alt=""
						className="w-10 h-10 rounded-full border border-outline-variant"
					/>
				) : (
					<div className="w-10 h-10 rounded-full bg-surface-container-low border border-outline-variant flex items-center justify-center">
						<span className="text-muted-foreground text-sm font-mono">
							{(thread.counterpartyUsername[0] ?? "?").toUpperCase()}
						</span>
					</div>
				)}
				<div>
					<p className="text-foreground font-mono text-sm font-medium">
						{thread.counterpartyUsername}
					</p>
					<p className="text-muted-foreground font-mono text-xs uppercase tracking-widest">
						Counterparty
					</p>
				</div>
			</div>

			{/* Open in Desktop CTA */}
			{!isTerminal && (
				<a
					href={`digswap://trade/${thread.tradeId}`}
					className="inline-flex items-center gap-2 bg-primary hover:bg-primary text-background font-mono text-xs font-bold px-4 py-2 rounded transition-colors"
				>
					<span className="material-symbols-outlined text-sm">open_in_new</span>
					Open in Desktop
				</a>
			)}
		</div>
	);
}
