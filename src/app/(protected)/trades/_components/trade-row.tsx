"use client";

import Link from "next/link";
import type { TradeInboxRow } from "@/lib/trades/queries";

const STATUS_STYLES: Record<
	string,
	string
> = {
	pending: "text-tertiary bg-tertiary/10 border-tertiary/20",
	accepted: "text-secondary bg-secondary/10 border-secondary/20",
	transferring: "text-primary bg-primary/10 border-primary/20",
	completed: "text-primary bg-primary/10 border-primary/20",
	declined: "text-on-surface-variant bg-surface-container-high",
	cancelled: "text-on-surface-variant bg-surface-container-high",
	expired: "text-destructive bg-destructive/10 border-destructive/20",
};

function formatRelativeTime(dateStr: string): string {
	const date = new Date(dateStr);
	const now = new Date();
	const diffMs = now.getTime() - date.getTime();
	const diffMins = Math.floor(diffMs / 60000);
	const diffHours = Math.floor(diffMs / 3600000);
	const diffDays = Math.floor(diffMs / 86400000);

	if (diffMins < 1) return "just now";
	if (diffMins < 60) return `${diffMins}m ago`;
	if (diffHours < 24) return `${diffHours}h ago`;
	if (diffDays < 30) return `${diffDays}d ago`;
	return `${Math.floor(diffDays / 30)}mo ago`;
}

function renderStars(rating: number): string {
	return "\u2605".repeat(rating) + "\u2606".repeat(5 - rating);
}

interface TradeRowProps {
	trade: TradeInboxRow;
}

export function TradeRow({ trade }: TradeRowProps) {
	const statusStyle =
		STATUS_STYLES[trade.status] ??
		"text-on-surface-variant bg-surface-container-high";

	const href =
		trade.status === "completed"
			? `/trades/${trade.id}/complete`
			: `/trades/${trade.id}`;

	return (
		<li role="listitem">
			<Link
				href={href}
				className="flex items-center gap-2 h-14 bg-surface-container-low border border-outline-variant/10 rounded-lg px-4 hover:bg-surface-container-high transition-colors"
			>
				{/* Status badge */}
				<span
					className={`inline-flex items-center px-2 py-0.5 rounded border font-mono text-[10px] uppercase shrink-0 ${statusStyle}`}
				>
					{trade.status}
				</span>

				{/* Dot separator */}
				<span className="text-outline font-mono text-[10px]">.</span>

				{/* Counterparty */}
				<span className="text-secondary font-mono text-[10px] shrink-0 truncate max-w-[100px]">
					{trade.counterpartyUsername ?? "unknown"}
				</span>

				{/* Dot separator */}
				<span className="text-outline font-mono text-[10px]">.</span>

				{/* Record title */}
				<span className="text-on-surface font-mono text-[10px] flex-1 truncate">
					{trade.releaseTitle ?? "Untitled"}
				</span>

				{/* Dot separator */}
				<span className="text-outline font-mono text-[10px]">.</span>

				{/* Date */}
				<span className="text-on-surface-variant font-mono text-[10px] shrink-0">
					{formatRelativeTime(trade.createdAt)}
				</span>

				{/* Rating (completed only) */}
				{trade.status === "completed" && trade.qualityRating != null && (
					<>
						<span className="text-outline font-mono text-[10px]">.</span>
						<span className="text-secondary font-mono text-[10px] shrink-0">
							{renderStars(trade.qualityRating)}
						</span>
					</>
				)}
			</Link>
		</li>
	);
}

interface TradeRowListProps {
	trades: TradeInboxRow[];
}

export function TradeRowList({ trades }: TradeRowListProps) {
	return (
		<ul role="list" className="space-y-2">
			{trades.map((trade) => (
				<TradeRow key={trade.id} trade={trade} />
			))}
		</ul>
	);
}
