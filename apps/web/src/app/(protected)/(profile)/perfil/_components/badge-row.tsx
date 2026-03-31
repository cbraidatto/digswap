interface BadgeRowProps {
	badges: Array<{
		slug: string;
		name: string;
		description: string | null;
	}>;
}

export function BadgeRow({ badges }: BadgeRowProps) {
	if (badges.length === 0) return null;

	return (
		<div className="flex flex-wrap gap-2 mt-3" aria-label="Earned badges">
			{badges.map((badge) => (
				<span
					key={badge.slug}
					className="font-mono text-[10px] text-primary/80 bg-primary/8 border border-primary/15 px-2 py-1 rounded"
					title={badge.description ?? undefined}
				>
					[{badge.name}]
				</span>
			))}
		</div>
	);
}
