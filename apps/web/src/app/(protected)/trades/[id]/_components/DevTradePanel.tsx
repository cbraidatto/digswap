"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { devForceTradeStatusAction } from "@/actions/trades";

const STATUSES = ["lobby", "previewing", "accepted", "transferring", "completed"] as const;

interface Props {
	tradeId: string;
	currentStatus: string;
}

export function DevTradePanel({ tradeId, currentStatus }: Props) {
	const router = useRouter();
	const [loading, setLoading] = useState<string | null>(null);
	const [error, setError] = useState<string | null>(null);

	async function force(status: string) {
		setLoading(status);
		setError(null);
		const result = await devForceTradeStatusAction(tradeId, status);
		setLoading(null);
		if (!result.success) {
			setError(result.error ?? "Failed");
		} else {
			router.refresh();
		}
	}

	return (
		<div className="rounded border border-dashed border-violet-500/40 bg-violet-500/5 p-3 flex flex-col gap-2">
			<p className="text-[10px] font-mono uppercase tracking-widest text-violet-400/70 font-bold">
				Dev · Force Status
			</p>
			<div className="flex flex-wrap gap-1.5">
				{STATUSES.map((s) => (
					<button
						key={s}
						type="button"
						disabled={s === currentStatus || loading !== null}
						onClick={() => force(s)}
						className={[
							"px-2.5 py-1 rounded text-[10px] font-mono font-bold transition-all border",
							s === currentStatus
								? "border-violet-400/40 bg-violet-400/15 text-violet-400 cursor-default"
								: "border-violet-500/25 bg-transparent text-violet-400/50 hover:text-violet-400 hover:border-violet-400/40 hover:bg-violet-400/10",
							loading === s ? "opacity-50 cursor-not-allowed" : "",
						].join(" ")}
					>
						{loading === s ? "…" : s}
					</button>
				))}
			</div>
			{error && <p className="text-[10px] text-destructive font-mono">{error}</p>}
		</div>
	);
}
