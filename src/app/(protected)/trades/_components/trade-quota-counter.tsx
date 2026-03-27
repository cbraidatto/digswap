"use client";

interface TradeQuotaCounterProps {
	count: number;
	total: number;
	plan: string;
}

export function TradeQuotaCounter({
	count,
	total,
	plan,
}: TradeQuotaCounterProps) {
	if (plan !== "free") {
		return (
			<div className="text-[10px] font-mono text-on-surface-variant">
				TRADES_THIS_MONTH:{" "}
				<span className="text-primary">UNLIMITED</span>
			</div>
		);
	}

	const filled = Math.min(count, total);
	const barSegments = 10;
	const filledSegments = Math.round((filled / total) * barSegments);
	const emptySegments = barSegments - filledSegments;

	const isAtLimit = count >= total;
	const isApproaching = count >= total - 1 && count < total;

	const colorClass = isAtLimit
		? "text-tertiary"
		: isApproaching
			? "text-tertiary"
			: "text-primary";

	return (
		<div className="text-[10px] font-mono text-on-surface-variant flex items-center gap-2">
			<span>TRADES_THIS_MONTH:</span>
			<span className={colorClass}>
				{count}/{total}
			</span>
			<span className={colorClass}>
				[{"=".repeat(filledSegments)}
				{"-".repeat(emptySegments)}]
			</span>
		</div>
	);
}
