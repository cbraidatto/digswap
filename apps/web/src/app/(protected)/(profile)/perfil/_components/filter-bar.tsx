"use client";

import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuRadioGroup,
	DropdownMenuRadioItem,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { DECADES, SORT_OPTIONS, type CollectionFilters } from "@/lib/collection/filters";

interface FilterBarProps {
	genres: string[];
	formats: string[];
	currentFilters: CollectionFilters;
	basePath: string;
}

function buildFilterUrl(
	basePath: string,
	currentFilters: CollectionFilters,
	overrides: Partial<CollectionFilters>,
): string {
	const merged = { ...currentFilters, ...overrides, page: 1 };
	const params = new URLSearchParams();

	if (merged.genre) params.set("genre", merged.genre);
	if (merged.decade) params.set("decade", merged.decade);
	if (merged.format) params.set("format", merged.format);
	if (merged.sort && merged.sort !== "rarity") params.set("sort", merged.sort);

	const qs = params.toString();
	return qs ? `${basePath}?${qs}` : basePath;
}

export function FilterBar({
	genres,
	formats,
	currentFilters,
	basePath,
}: FilterBarProps) {
	const router = useRouter();

	const handleGenreChange = (value: string) => {
		const genre = value === "__all__" ? undefined : value;
		router.push(buildFilterUrl(basePath, currentFilters, { genre }));
	};

	const handleDecadeChange = (value: string) => {
		const decade = value === "__all__" ? undefined : value;
		router.push(buildFilterUrl(basePath, currentFilters, { decade }));
	};

	const handleFormatChange = (value: string) => {
		const format = value === "__all__" ? undefined : value;
		router.push(buildFilterUrl(basePath, currentFilters, { format }));
	};

	const handleSortChange = (value: string) => {
		router.push(
			buildFilterUrl(basePath, currentFilters, {
				sort: value as CollectionFilters["sort"],
			}),
		);
	};

	return (
		<div className="flex items-center gap-2 overflow-x-auto py-3 px-4 md:px-6">
			{/* Genre Filter */}
			<DropdownMenu>
				<DropdownMenuTrigger
					render={
						<Button
							variant="outline"
							size="sm"
							className={`font-mono text-xs uppercase tracking-wider ${
								currentFilters.genre
									? "bg-primary/10 border-primary/30"
									: ""
							}`}
						/>
					}
				>
					{currentFilters.genre ?? "Genre"}
				</DropdownMenuTrigger>
				<DropdownMenuContent>
					<DropdownMenuRadioGroup
						value={currentFilters.genre ?? "__all__"}
						onValueChange={handleGenreChange}
					>
						<DropdownMenuRadioItem value="__all__">
							All Genres
						</DropdownMenuRadioItem>
						<DropdownMenuSeparator />
						{genres.map((genre) => (
							<DropdownMenuRadioItem key={genre} value={genre}>
								{genre}
							</DropdownMenuRadioItem>
						))}
					</DropdownMenuRadioGroup>
				</DropdownMenuContent>
			</DropdownMenu>

			{/* Decade Filter */}
			<DropdownMenu>
				<DropdownMenuTrigger
					render={
						<Button
							variant="outline"
							size="sm"
							className={`font-mono text-xs uppercase tracking-wider ${
								currentFilters.decade
									? "bg-primary/10 border-primary/30"
									: ""
							}`}
						/>
					}
				>
					{currentFilters.decade ?? "Decade"}
				</DropdownMenuTrigger>
				<DropdownMenuContent>
					<DropdownMenuRadioGroup
						value={currentFilters.decade ?? "__all__"}
						onValueChange={handleDecadeChange}
					>
						<DropdownMenuRadioItem value="__all__">
							All Decades
						</DropdownMenuRadioItem>
						<DropdownMenuSeparator />
						{DECADES.map((d) => (
							<DropdownMenuRadioItem key={d.label} value={d.label}>
								{d.label}
							</DropdownMenuRadioItem>
						))}
					</DropdownMenuRadioGroup>
				</DropdownMenuContent>
			</DropdownMenu>

			{/* Format Filter */}
			<DropdownMenu>
				<DropdownMenuTrigger
					render={
						<Button
							variant="outline"
							size="sm"
							className={`font-mono text-xs uppercase tracking-wider ${
								currentFilters.format
									? "bg-primary/10 border-primary/30"
									: ""
							}`}
						/>
					}
				>
					{currentFilters.format ?? "Format"}
				</DropdownMenuTrigger>
				<DropdownMenuContent>
					<DropdownMenuRadioGroup
						value={currentFilters.format ?? "__all__"}
						onValueChange={handleFormatChange}
					>
						<DropdownMenuRadioItem value="__all__">
							All Formats
						</DropdownMenuRadioItem>
						<DropdownMenuSeparator />
						{formats.map((format) => (
							<DropdownMenuRadioItem key={format} value={format}>
								{format}
							</DropdownMenuRadioItem>
						))}
					</DropdownMenuRadioGroup>
				</DropdownMenuContent>
			</DropdownMenu>

			{/* Sort */}
			<DropdownMenu>
				<DropdownMenuTrigger
					render={
						<Button
							variant="outline"
							size="sm"
							className={`font-mono text-xs uppercase tracking-wider ${
								currentFilters.sort !== "rarity"
									? "bg-primary/10 border-primary/30"
									: ""
							}`}
						/>
					}
				>
					Sort: {SORT_OPTIONS.find((o) => o.value === currentFilters.sort)?.label ?? "Rarity"}
				</DropdownMenuTrigger>
				<DropdownMenuContent>
					<DropdownMenuRadioGroup
						value={currentFilters.sort}
						onValueChange={handleSortChange}
					>
						{SORT_OPTIONS.map((option) => (
							<DropdownMenuRadioItem key={option.value} value={option.value}>
								{option.label}
							</DropdownMenuRadioItem>
						))}
					</DropdownMenuRadioGroup>
				</DropdownMenuContent>
			</DropdownMenu>
		</div>
	);
}
