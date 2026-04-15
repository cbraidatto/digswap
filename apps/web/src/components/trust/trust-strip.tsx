import { getTrustMetrics } from "@/lib/trades/queries";

interface TrustStripProps {
	userId: string;
	variant?: "compact" | "full";
}

export async function TrustStrip({ userId, variant = "full" }: TrustStripProps) {
	const { responseRate, completionRate, avgQuality, totalTrades } = await getTrustMetrics(userId);

	const metrics = [
		{ label: "RESPONSE", value: `${responseRate}%` },
		{ label: "COMPLETION", value: `${completionRate}%` },
		{ label: "AVG_QUALITY", value: `${avgQuality}\u2605` },
		{ label: "TRADES", value: String(totalTrades) },
	];

	if (variant === "compact") {
		return (
			<div className="flex items-center gap-3 font-mono text-xs">
				{metrics.map((m) => (
					<span key={m.label} className="text-on-surface-variant">
						<span className="text-on-surface-variant/60">{m.label}: </span>
						<span className="text-on-surface">{m.value}</span>
					</span>
				))}
			</div>
		);
	}

	return (
		<div className="grid grid-cols-4 gap-2 p-3.5 bg-surface-container-low rounded border border-outline-variant/10">
			{metrics.map((m) => (
				<div key={m.label} className="text-center">
					<div className="font-mono text-lg font-bold text-on-surface">{m.value}</div>
					<div className="font-mono text-[10px] text-on-surface-variant tracking-[0.12em] mt-1">
						{m.label}
					</div>
				</div>
			))}
		</div>
	);
}
