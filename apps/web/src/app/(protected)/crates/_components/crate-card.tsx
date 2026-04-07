"use client";

import Link from "next/link";
import type { CrateRow } from "@/lib/crates/types";

type SessionType = CrateRow["sessionType"];

const SESSION_TYPE_CHIP: Record<NonNullable<SessionType>, { label: string; className: string }> = {
	digging_trip: {
		label: "[DIGGING_TRIP]",
		className: "text-primary border-primary/30",
	},
	event_prep: {
		label: "[EVENT_PREP]",
		className: "text-secondary border-secondary/30",
	},
	wish_list: {
		label: "[WISH_LIST]",
		className: "text-tertiary border-tertiary/30",
	},
	other: {
		label: "[OTHER]",
		className: "text-on-surface-variant border-outline-variant",
	},
};

interface CrateCardProps {
	crate: CrateRow & { itemCount: number };
}

export function CrateCard({ crate }: CrateCardProps) {
	const chip = crate.sessionType
		? (SESSION_TYPE_CHIP[crate.sessionType] ?? SESSION_TYPE_CHIP.other)
		: SESSION_TYPE_CHIP.other;

	const displayDate = crate.date
		? new Date(`${crate.date}T00:00:00`).toLocaleDateString("en-GB", {
				day: "2-digit",
				month: "short",
				year: "numeric",
			})
		: null;

	return (
		<Link
			href={`/crates/${crate.id}`}
			className="block bg-surface-container-low rounded-lg p-4 border border-outline-variant/10 hover:bg-surface-container-high transition-colors"
		>
			<div className="flex items-start justify-between gap-2 mb-1.5">
				<span className="font-heading text-sm font-bold text-on-surface truncate">
					{crate.name}
				</span>
				<span
					className={`font-mono text-xs px-1.5 py-0.5 rounded border flex-shrink-0 ${chip.className}`}
				>
					{chip.label}
				</span>
			</div>
			<div className="flex items-center justify-between">
				{displayDate && (
					<span className="font-mono text-xs text-on-surface-variant">{displayDate}</span>
				)}
				<span className="font-mono text-xs text-on-surface-variant ml-auto">
					{crate.itemCount} {crate.itemCount === 1 ? "item" : "items"}
				</span>
			</div>
		</Link>
	);
}
