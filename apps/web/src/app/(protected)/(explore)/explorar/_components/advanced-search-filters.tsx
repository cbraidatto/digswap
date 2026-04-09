"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCallback, useMemo, useState } from "react";
import { DISCOGS_STYLES_BY_GENRE, type DiscogsGenre } from "@/lib/discogs/taxonomy";

const GENRE_OPTIONS = [
	"Jazz",
	"Rock",
	"Electronic",
	"Soul",
	"Funk / Soul",
	"Hip Hop",
	"Classical",
	"Pop",
	"Country",
	"Blues",
	"Reggae",
	"Latin",
] as const;

const FORMAT_OPTIONS = [
	{ label: "All Formats", value: "" },
	{ label: "LP", value: "LP" },
	{ label: '7"', value: '7"' },
	{ label: '10"', value: '10"' },
	{ label: "CD", value: "CD" },
] as const;

const SORT_OPTIONS = [
	{ label: "Rarity", value: "rarity" },
	{ label: "Year", value: "year" },
	{ label: "A-Z", value: "alpha" },
	{ label: "Most Owned", value: "owners" },
] as const;

export function AdvancedSearchFilters() {
	const router = useRouter();
	const pathname = usePathname();
	const searchParams = useSearchParams();

	// Read current values from URL
	const activeGenres = searchParams.getAll("genre");
	const activeStyles = searchParams.getAll("style");
	const activeCountry = searchParams.get("country") ?? "";
	const activeLabel = searchParams.get("label") ?? "";
	const activeFormat = searchParams.get("format") ?? "";
	const activeSort = searchParams.get("sort") ?? "rarity";
	const activeMinRarity = Number(searchParams.get("minRarity") ?? "0");
	const activeYearFrom = searchParams.get("yearFrom") ?? "";
	const activeYearTo = searchParams.get("yearTo") ?? "";
	const [showStyles, setShowStyles] = useState(false);

	// Compute available styles based on selected genres
	const availableStyles = useMemo(() => {
		if (activeGenres.length === 0) return [];
		const styles = new Set<string>();
		for (const g of activeGenres) {
			const genreStyles = DISCOGS_STYLES_BY_GENRE[g as DiscogsGenre];
			if (genreStyles) {
				for (const s of genreStyles) styles.add(s);
			}
		}
		return [...styles].sort();
	}, [activeGenres]);

	const updateParam = useCallback(
		(updates: Record<string, string | string[] | null>) => {
			const params = new URLSearchParams(searchParams.toString());

			for (const [key, value] of Object.entries(updates)) {
				params.delete(key);
				if (Array.isArray(value)) {
					for (const v of value) {
						params.append(key, v);
					}
				} else if (value !== null && value !== "") {
					params.set(key, value);
				}
			}

			// Preserve tab param if set
			const qs = params.toString();
			router.push(`${pathname}${qs ? `?${qs}` : ""}`);
		},
		[router, pathname, searchParams],
	);

	const toggleGenre = (genre: string) => {
		const next = activeGenres.includes(genre)
			? activeGenres.filter((g) => g !== genre)
			: [...activeGenres, genre];
		// Clear styles when genres change (styles depend on genres)
		updateParam({ genre: next, style: [] });
	};

	const toggleStyle = (style: string) => {
		const next = activeStyles.includes(style)
			? activeStyles.filter((s) => s !== style)
			: [...activeStyles, style];
		updateParam({ style: next });
	};

	const handleCountryChange = (e: React.ChangeEvent<HTMLInputElement>) => {
		updateParam({ country: e.target.value });
	};

	const handleLabelChange = (e: React.ChangeEvent<HTMLInputElement>) => {
		updateParam({ label: e.target.value });
	};

	const handleFormatChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
		updateParam({ format: e.target.value });
	};

	const handleSortChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
		updateParam({ sort: e.target.value === "rarity" ? null : e.target.value });
	};

	const handleYearFromChange = (e: React.ChangeEvent<HTMLInputElement>) => {
		updateParam({ yearFrom: e.target.value || null });
	};

	const handleYearToChange = (e: React.ChangeEvent<HTMLInputElement>) => {
		updateParam({ yearTo: e.target.value || null });
	};

	const handleMinRarityChange = (e: React.ChangeEvent<HTMLInputElement>) => {
		const val = Number(e.target.value);
		updateParam({ minRarity: val > 0 ? String(val) : null });
	};

	const hasActiveFilters =
		activeGenres.length > 0 ||
		activeStyles.length > 0 ||
		activeCountry !== "" ||
		activeLabel !== "" ||
		activeFormat !== "" ||
		activeMinRarity > 0 ||
		activeYearFrom !== "" ||
		activeYearTo !== "";

	const clearAll = () => {
		updateParam({
			genre: [],
			style: [],
			country: null,
			label: null,
			format: null,
			minRarity: null,
			yearFrom: null,
			yearTo: null,
		});
		setShowStyles(false);
	};

	return (
		<div className="space-y-3">
			{/* Header row */}
			<div className="flex items-center justify-between">
				<span className="font-mono text-xs text-on-surface-variant uppercase tracking-[0.2em]">
					FILTERS
				</span>
				{hasActiveFilters && (
					<button
						type="button"
						onClick={clearAll}
						className="font-mono text-xs text-primary hover:underline"
					>
						CLEAR_ALL
					</button>
				)}
			</div>

			{/* Genre chips — horizontally scrollable on mobile */}
			<div className="flex gap-2 overflow-x-auto scrollbar-none pb-1">
				{GENRE_OPTIONS.map((genre) => {
					const isActive = activeGenres.includes(genre);
					return (
						<button
							key={genre}
							type="button"
							onClick={() => toggleGenre(genre)}
							aria-pressed={isActive}
							className={`px-3 py-1 rounded-full font-mono text-xs whitespace-nowrap shrink-0 transition-colors border ${
								isActive
									? "bg-primary/10 text-primary border-primary"
									: "bg-surface-container-low text-on-surface-variant border-outline-variant/20 hover:bg-surface-container hover:text-on-surface"
							}`}
						>
							{genre}
						</button>
					);
				})}
			</div>

			{/* Style chips — shown when genres are selected */}
			{activeGenres.length > 0 && availableStyles.length > 0 && (
				<div>
					<button
						type="button"
						onClick={() => setShowStyles(!showStyles)}
						className="font-mono text-[10px] text-on-surface-variant uppercase tracking-widest mb-1.5 flex items-center gap-1 hover:text-on-surface transition-colors"
					>
						<span className="material-symbols-outlined text-xs">
							{showStyles ? "expand_less" : "expand_more"}
						</span>
						Styles ({availableStyles.length})
						{activeStyles.length > 0 && (
							<span className="text-primary ml-1">· {activeStyles.length} selected</span>
						)}
					</button>
					{showStyles && (
						<div className="flex gap-1.5 overflow-x-auto scrollbar-none pb-1 flex-wrap">
							{availableStyles.map((style) => {
								const isActive = activeStyles.includes(style);
								return (
									<button
										key={style}
										type="button"
										onClick={() => toggleStyle(style)}
										aria-pressed={isActive}
										className={`px-2 py-0.5 rounded-full font-mono text-[10px] whitespace-nowrap shrink-0 transition-colors border ${
											isActive
												? "bg-secondary/10 text-secondary border-secondary"
												: "bg-surface-container-low text-on-surface-variant border-outline-variant/20 hover:bg-surface-container hover:text-on-surface"
										}`}
									>
										{style}
									</button>
								);
							})}
						</div>
					)}
				</div>
			)}

			{/* Second row: label, country, format, minRarity */}
			<div className="flex flex-wrap gap-3 items-end">
				{/* Label */}
				<div className="flex flex-col gap-1 min-w-[140px]">
					<label
						htmlFor="filter-label"
						className="font-mono text-[10px] text-on-surface-variant uppercase tracking-widest"
					>
						Label
					</label>
					<input
						id="filter-label"
						type="text"
						value={activeLabel}
						onChange={handleLabelChange}
						placeholder="e.g. Blue Note..."
						className="bg-surface-container-low border border-outline-variant/20 rounded px-2 py-1 font-mono text-xs text-on-surface placeholder:text-on-surface-variant/40 focus:outline-none focus:border-primary/50 w-full"
					/>
				</div>

				{/* Country */}
				<div className="flex flex-col gap-1 min-w-[120px]">
					<label
						htmlFor="filter-country"
						className="font-mono text-[10px] text-on-surface-variant uppercase tracking-widest"
					>
						Country
					</label>
					<input
						id="filter-country"
						type="text"
						value={activeCountry}
						onChange={handleCountryChange}
						placeholder="e.g. US, UK..."
						className="bg-surface-container-low border border-outline-variant/20 rounded px-2 py-1 font-mono text-xs text-on-surface placeholder:text-on-surface-variant/40 focus:outline-none focus:border-primary/50 w-full"
					/>
				</div>

				{/* Format */}
				<div className="flex flex-col gap-1 min-w-[100px]">
					<label
						htmlFor="filter-format"
						className="font-mono text-[10px] text-on-surface-variant uppercase tracking-widest"
					>
						Format
					</label>
					<select
						id="filter-format"
						value={activeFormat}
						onChange={handleFormatChange}
						className="bg-surface-container-low border border-outline-variant/20 rounded px-2 py-1 font-mono text-xs text-on-surface focus:outline-none focus:border-primary/50"
					>
						{FORMAT_OPTIONS.map((opt) => (
							<option key={opt.value} value={opt.value}>
								{opt.label}
							</option>
						))}
					</select>
				</div>

				{/* Sort */}
				<div className="flex flex-col gap-1 min-w-[100px]">
					<label
						htmlFor="filter-sort"
						className="font-mono text-[10px] text-on-surface-variant uppercase tracking-widest"
					>
						Sort by
					</label>
					<select
						id="filter-sort"
						value={activeSort}
						onChange={handleSortChange}
						className="bg-surface-container-low border border-outline-variant/20 rounded px-2 py-1 font-mono text-xs text-on-surface focus:outline-none focus:border-primary/50"
					>
						{SORT_OPTIONS.map((opt) => (
							<option key={opt.value} value={opt.value}>
								{opt.label}
							</option>
						))}
					</select>
				</div>

				{/* Year range */}
				<div className="flex flex-col gap-1 min-w-[100px]">
					<label
						htmlFor="filter-year-from"
						className="font-mono text-[10px] text-on-surface-variant uppercase tracking-widest"
					>
						Year from
					</label>
					<input
						id="filter-year-from"
						type="number"
						value={activeYearFrom}
						onChange={handleYearFromChange}
						placeholder="1950"
						min={1900}
						max={2030}
						className="bg-surface-container-low border border-outline-variant/20 rounded px-2 py-1 font-mono text-xs text-on-surface placeholder:text-on-surface-variant/40 focus:outline-none focus:border-primary/50 w-full"
					/>
				</div>
				<div className="flex flex-col gap-1 min-w-[100px]">
					<label
						htmlFor="filter-year-to"
						className="font-mono text-[10px] text-on-surface-variant uppercase tracking-widest"
					>
						Year to
					</label>
					<input
						id="filter-year-to"
						type="number"
						value={activeYearTo}
						onChange={handleYearToChange}
						placeholder="2026"
						min={1900}
						max={2030}
						className="bg-surface-container-low border border-outline-variant/20 rounded px-2 py-1 font-mono text-xs text-on-surface placeholder:text-on-surface-variant/40 focus:outline-none focus:border-primary/50 w-full"
					/>
				</div>

				{/* Min Rarity */}
				<div className="flex flex-col gap-1 min-w-[140px]">
					<label
						htmlFor="filter-min-rarity"
						className="font-mono text-[10px] text-on-surface-variant uppercase tracking-widest"
					>
						Min Rarity: <span className="text-primary">{activeMinRarity}</span>
					</label>
					<input
						id="filter-min-rarity"
						type="range"
						min={0}
						max={100}
						step={5}
						value={activeMinRarity}
						onChange={handleMinRarityChange}
						className="accent-primary w-full"
					/>
				</div>
			</div>
		</div>
	);
}
