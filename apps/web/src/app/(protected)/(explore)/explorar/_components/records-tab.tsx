"use client";

import { useCallback } from "react";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { RecordSearch } from "./record-search";
import { BrowseFilters } from "./browse-filters";
import { AdvancedSearchFilters } from "./advanced-search-filters";
import { BrowseGrid } from "./browse-grid";
import { SuggestedSection } from "./suggested-section";
import { TrendingSection } from "./trending-section";

export function RecordsTab() {
	const router = useRouter();
	const pathname = usePathname();
	const searchParams = useSearchParams();

	// URL-driven filter values
	const urlGenres = searchParams.getAll("genre");
	const urlStyles = searchParams.getAll("style");
	const urlCountry = searchParams.get("country") ?? null;
	const urlLabel = searchParams.get("label") ?? null;
	const urlFormat = searchParams.get("format") ?? null;
	const urlSort = searchParams.get("sort") ?? "rarity";
	const urlMinRarity = Number(searchParams.get("minRarity") ?? "0");
	const urlYearFrom = searchParams.get("yearFrom") ? Number(searchParams.get("yearFrom")) : null;
	const urlYearTo = searchParams.get("yearTo") ? Number(searchParams.get("yearTo")) : null;
	// Legacy single-genre and decade (kept for BrowseFilters)
	const legacyGenre = searchParams.get("lgGenre") ?? null;
	const legacyDecade = searchParams.get("decade") ?? null;

	const updateParam = useCallback(
		(key: string, value: string | null) => {
			const params = new URLSearchParams(searchParams.toString());
			if (value) {
				params.set(key, value);
			} else {
				params.delete(key);
			}
			const qs = params.toString();
			router.push(`${pathname}${qs ? `?${qs}` : ""}`);
		},
		[router, pathname, searchParams],
	);

	return (
		<div className="w-full p-8 md:p-12">
			<div className="max-w-4xl mx-auto space-y-8">
				<TrendingSection />
				<RecordSearch />
				<div className="space-y-4">
					{/* Advanced stackable filters (URL-driven: genre chips, country, format, rarity) */}
					<AdvancedSearchFilters />

					{/* Legacy decade filter */}
					<BrowseFilters
						selectedGenre={legacyGenre}
						selectedDecade={legacyDecade}
						onGenreChange={(g) => updateParam("lgGenre", g)}
						onDecadeChange={(d) => updateParam("decade", d)}
					/>

					<BrowseGrid
						genre={legacyGenre}
						decade={legacyDecade}
						genres={urlGenres}
						styles={urlStyles}
						country={urlCountry}
						label={urlLabel}
						format={urlFormat}
						minRarity={urlMinRarity}
						sort={urlSort}
						yearFrom={urlYearFrom}
						yearTo={urlYearTo}
					/>
				</div>
				<SuggestedSection />
			</div>
		</div>
	);
}
