"use client";

import { DECADES } from "@/lib/collection/filters";
import { DISCOGS_GENRES } from "@/lib/discogs/taxonomy";

/**
 * Subset of Discogs genres most relevant for vinyl digger browsing.
 * Selected from the full 15 official genres to show the most popular/useful ones.
 */
const BROWSE_GENRES = DISCOGS_GENRES.filter((g) =>
	[
		"Electronic",
		"Jazz",
		"Hip Hop",
		"Rock",
		"Funk / Soul",
		"Latin",
		"Classical",
		"Blues",
		"Pop",
		"Reggae",
	].includes(g),
);

interface BrowseFiltersProps {
	selectedGenre: string | null;
	selectedDecade: string | null;
	onGenreChange: (genre: string | null) => void;
	onDecadeChange: (decade: string | null) => void;
}

export function BrowseFilters({
	selectedGenre,
	selectedDecade,
	onGenreChange,
	onDecadeChange,
}: BrowseFiltersProps) {
	return (
		<div className="space-y-4">
			{/* Genre Row */}
			<div className="flex flex-wrap items-center gap-2">
				<span className="font-mono text-xs uppercase tracking-[0.2em] text-outline mr-2">
					Genre:
				</span>
				{BROWSE_GENRES.map((genre) => {
					const isActive = selectedGenre === genre;
					return (
						<button
							key={genre}
							type="button"
							onClick={() => onGenreChange(isActive ? null : genre)}
							className={`px-4 py-1 rounded-full font-mono text-xs transition-colors ${
								isActive
									? "bg-primary/10 text-primary border border-primary"
									: "bg-surface-container-low text-on-surface-variant border border-outline-variant/20 hover:bg-surface-container hover:text-on-surface"
							}`}
							aria-pressed={isActive}
						>
							{genre}
						</button>
					);
				})}
			</div>

			{/* Decade Row */}
			<div className="flex flex-wrap items-center gap-2">
				<span className="font-mono text-xs uppercase tracking-[0.2em] text-outline mr-2">
					Decade:
				</span>
				{DECADES.map((decade) => {
					const isActive = selectedDecade === decade.label;
					return (
						<button
							key={decade.label}
							type="button"
							onClick={() => onDecadeChange(isActive ? null : decade.label)}
							className={`px-4 py-1 rounded-full font-mono text-xs transition-colors ${
								isActive
									? "bg-primary/10 text-primary border border-primary"
									: "bg-surface-container-low text-on-surface-variant border border-outline-variant/20 hover:bg-surface-container hover:text-on-surface"
							}`}
							aria-pressed={isActive}
						>
							{decade.label}
						</button>
					);
				})}
			</div>
		</div>
	);
}
