export function StarRating({
	rating,
	maxStars = 5,
}: {
	rating: number;
	maxStars?: number;
}) {
	const filled = Math.max(0, Math.min(maxStars, Math.round(rating)));
	const empty = maxStars - filled;

	return (
		<span
			className="font-mono text-sm inline-flex"
			aria-label={`${filled} out of ${maxStars} stars`}
		>
			<span className="text-tertiary">
				{"\u2605".repeat(filled)}
			</span>
			<span className="text-on-surface-variant/40">
				{"\u2606".repeat(empty)}
			</span>
		</span>
	);
}
