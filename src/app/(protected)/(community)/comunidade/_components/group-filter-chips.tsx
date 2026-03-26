"use client";

interface GroupFilterChipsProps {
	genres: string[];
	activeGenre: string | null;
	onGenreChange: (genre: string | null) => void;
}

export function GroupFilterChips({
	genres,
	activeGenre,
	onGenreChange,
}: GroupFilterChipsProps) {
	return (
		<div className="flex items-start gap-2 flex-wrap">
			<span className="font-mono text-[10px] text-on-surface-variant py-1">
				Genre:
			</span>
			<button
				type="button"
				onClick={() => onGenreChange(null)}
				aria-pressed={activeGenre === null}
				className={`font-mono text-[10px] px-2 py-1 rounded transition-colors ${
					activeGenre === null
						? "bg-primary/10 text-primary border border-primary"
						: "bg-surface-container-low text-on-surface-variant border border-outline-variant/20 hover:text-on-surface"
				}`}
			>
				All
			</button>
			{genres.map((genre) => (
				<button
					key={genre}
					type="button"
					onClick={() =>
						onGenreChange(activeGenre === genre ? null : genre)
					}
					aria-pressed={activeGenre === genre}
					className={`font-mono text-[10px] px-2 py-1 rounded transition-colors ${
						activeGenre === genre
							? "bg-primary/10 text-primary border border-primary"
							: "bg-surface-container-low text-on-surface-variant border border-outline-variant/20 hover:text-on-surface"
					}`}
				>
					{genre}
				</button>
			))}
		</div>
	);
}
