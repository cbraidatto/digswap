export type ContextReason = "dna_match" | "network" | "trending" | null;

const LABELS: Record<
	NonNullable<ContextReason>,
	{ icon: string; text: string }
> = {
	dna_match: { icon: "music_note", text: "Based on your taste" },
	network: { icon: "group", text: "From the community" },
	trending: { icon: "trending_up", text: "Trending find" },
};

export function ContextLabel({ reason }: { reason: ContextReason }) {
	if (!reason) return null;
	const { icon, text } = LABELS[reason];
	return (
		<div className="flex items-center gap-1 text-xs text-on-surface-variant/50 mt-1 px-4 pb-1">
			<span className="material-symbols-outlined text-[11px]">{icon}</span>
			<span>{text}</span>
		</div>
	);
}
