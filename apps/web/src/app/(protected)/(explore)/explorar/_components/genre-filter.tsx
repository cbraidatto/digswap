"use client";

import { DISCOGS_GENRES } from "@/lib/discogs/taxonomy";

interface GenreFilterProps {
	activeGenre: string | null;
	onGenreChange: (genre: string | null) => void;
	disabled?: boolean;
}

export function GenreFilter({
	activeGenre,
	onGenreChange,
	disabled,
}: GenreFilterProps) {
	const chipBase =
		"px-3 py-2 font-mono text-[10px] uppercase tracking-wider rounded-md border whitespace-nowrap flex-shrink-0 transition-colors";
	const chipActive =
		"bg-secondary/15 text-secondary border-secondary/30 font-bold";
	const chipInactive =
		"bg-transparent text-on-surface-variant border-outline-variant/20 hover:text-on-surface hover:border-outline-variant/40";

	return (
		<div
			className={`flex gap-2 overflow-x-auto scrollbar-none pb-2 ${
				disabled ? "opacity-50 pointer-events-none" : ""
			}`}
			role="radiogroup"
			aria-label="Leaderboard scope"
		>
			{/* GLOBAL chip */}
			<button
				type="button"
				role="radio"
				aria-checked={activeGenre === null}
				onClick={() => onGenreChange(null)}
				className={`${chipBase} ${activeGenre === null ? chipActive : chipInactive}`}
			>
				GLOBAL
			</button>

			{/* Genre chips */}
			{DISCOGS_GENRES.map((genre) => (
				<button
					key={genre}
					type="button"
					role="radio"
					aria-checked={activeGenre === genre}
					onClick={() => onGenreChange(genre)}
					className={`${chipBase} ${activeGenre === genre ? chipActive : chipInactive}`}
				>
					{genre}
				</button>
			))}
		</div>
	);
}
