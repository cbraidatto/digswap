"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { toast } from "sonner";
import { setVisibility } from "@/actions/collection";

type Visibility = "not_trading" | "tradeable" | "private";

const VISIBILITY_CYCLE: Visibility[] = ["not_trading", "tradeable", "private"];

const VISIBILITY_CONFIG: Record<Visibility, { icon: string; label: string; iconClass: string }> = {
	not_trading: {
		icon: "swap_horiz",
		label: "Not Trading",
		iconClass: "text-on-surface-variant/25",
	},
	tradeable: {
		icon: "swap_horiz",
		label: "Trading",
		iconClass: "text-primary",
	},
	private: {
		icon: "lock",
		label: "Private",
		iconClass: "text-on-surface-variant/40",
	},
};

interface VisibilitySelectorProps {
	itemId: string;
	currentVisibility: string;
	/** true = icon-only, false = icon+label */
	compact?: boolean;
}

export function VisibilitySelector({
	itemId,
	currentVisibility,
	compact = false,
}: VisibilitySelectorProps) {
	const router = useRouter();
	const [isPending, startTransition] = useTransition();

	const current = (currentVisibility as Visibility) || "not_trading";
	const config = VISIBILITY_CONFIG[current] ?? VISIBILITY_CONFIG.not_trading;
	const currentIndex = VISIBILITY_CYCLE.indexOf(current);
	const nextVisibility = VISIBILITY_CYCLE[(currentIndex + 1) % VISIBILITY_CYCLE.length];

	function handleClick(e: React.MouseEvent) {
		e.preventDefault();
		e.stopPropagation();

		startTransition(async () => {
			const result = await setVisibility(itemId, nextVisibility);
			if (result.error) {
				toast.error(result.error);
			} else {
				const nextConfig = VISIBILITY_CONFIG[nextVisibility];
				toast.success(`Marked as ${nextConfig.label}`);
				router.refresh();
			}
		});
	}

	return (
		<button
			type="button"
			onClick={handleClick}
			disabled={isPending}
			className={`inline-flex items-center gap-1 p-1 rounded-full transition-colors disabled:opacity-50 hover:bg-surface-container-high ${
				current === "tradeable" ? "bg-primary/10" : ""
			}`}
			title={`${config.label} (click to change)`}
		>
			<span
				className={`material-symbols-outlined text-[14px] ${config.iconClass} ${
					isPending ? "animate-pulse" : ""
				}`}
			>
				{config.icon}
			</span>
			{!compact && (
				<span className={`font-mono text-[10px] ${config.iconClass}`}>{config.label}</span>
			)}
		</button>
	);
}
