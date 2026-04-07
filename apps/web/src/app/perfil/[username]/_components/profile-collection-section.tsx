"use client";

import { useState } from "react";
import { CollectionGrid } from "@/app/(protected)/(profile)/perfil/_components/collection-grid";
import { FilterBar } from "@/app/(protected)/(profile)/perfil/_components/filter-bar";
import { Pagination } from "@/app/(protected)/(profile)/perfil/_components/pagination";
import { WantlistMatchSection } from "@/app/(protected)/(profile)/perfil/_components/wantlist-match-section";
import type { CollectionFilters } from "@/lib/collection/filters";
import type { CollectionItem } from "@/lib/collection/queries";
import type { WantlistIntersection } from "@/lib/wantlist/intersection-queries";

interface ProfileCollectionSectionProps {
	items: CollectionItem[];
	intersections: WantlistIntersection[];
	genres: string[];
	formats: string[];
	currentFilters: CollectionFilters;
	totalPages: number;
	username: string;
	searchParams: Record<string, string>;
}

export function ProfileCollectionSection({
	items,
	intersections,
	genres,
	formats,
	currentFilters,
	totalPages,
	username,
	searchParams,
}: ProfileCollectionSectionProps) {
	const [filterIds, setFilterIds] = useState<string[] | null>(null);

	return (
		<section>
			<div className="flex items-center justify-between mb-6">
				<div>
					<span className="font-mono text-xs text-primary tracking-[0.2em] uppercase">
						COLLECTION
					</span>
					<h2 className="text-2xl font-bold font-heading text-on-surface mt-1">
						{username}_Collection
					</h2>
				</div>
			</div>

			{/* Wantlist match section — only rendered when intersections > 0 (logged-in visitors only) */}
			{intersections.length > 0 && (
				<WantlistMatchSection intersections={intersections} onFilterChange={setFilterIds} />
			)}

			{/* Filter bar */}
			<FilterBar
				genres={genres}
				formats={formats}
				currentFilters={currentFilters}
				basePath={`/perfil/${username}`}
			/>

			{/* Collection grid with optional match filter */}
			<CollectionGrid items={items} isOwner={false} filterToIds={filterIds ?? undefined} />

			{/* Pagination — hidden when match filter is active */}
			{!filterIds && totalPages > 1 && (
				<Pagination
					currentPage={currentFilters.page}
					totalPages={totalPages}
					baseUrl={`/perfil/${username}`}
					searchParams={searchParams}
				/>
			)}
		</section>
	);
}
