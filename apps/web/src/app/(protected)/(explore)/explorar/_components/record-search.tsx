"use client";

import { useState, useRef, useCallback, useTransition } from "react";
import { searchRecordsAction } from "@/actions/discovery";
import type { SearchResult } from "@/lib/discovery/queries";
import { RecordSearchCard } from "./record-search-card";

export function RecordSearch() {
	const [query, setQuery] = useState("");
	const [results, setResults] = useState<SearchResult[]>([]);
	const [searched, setSearched] = useState(false);
	const [isPending, startTransition] = useTransition();
	const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

	const handleInputChange = useCallback(
		(e: React.ChangeEvent<HTMLInputElement>) => {
			const value = e.target.value;
			setQuery(value);

			if (timeoutRef.current) {
				clearTimeout(timeoutRef.current);
			}

			if (value.trim().length < 2) {
				setResults([]);
				setSearched(false);
				return;
			}

			timeoutRef.current = setTimeout(() => {
				startTransition(async () => {
					const data = await searchRecordsAction(value);
					setResults(data);
					setSearched(true);
				});
			}, 300);
		},
		[],
	);

	return (
		<div>
			{/* Section Header */}
			<div className="font-mono text-[10px] text-on-surface-variant uppercase tracking-[0.2em] mb-4">
				search_records
			</div>

			{/* Search Input */}
			<div className="relative flex items-center bg-surface-container-lowest p-4 border-l-4 border-primary">
				<span className="text-primary font-mono text-xl mr-4">&gt;</span>
				<input
					type="text"
					value={query}
					onChange={handleInputChange}
					className="w-full bg-transparent border-none focus:ring-0 text-on-surface font-mono text-lg placeholder:text-on-surface-variant/40 outline-none"
					placeholder="Search by record or artist..."
					role="searchbox"
					aria-label="Search records by name or artist"
				/>
				<span className="w-3 h-8 bg-primary blink ml-2" />
			</div>

			{/* Loading State */}
			{isPending && !searched && (
				<div className="font-mono text-[10px] text-on-surface-variant text-center py-8">
					searching...
				</div>
			)}

			{/* Results Header */}
			{searched && results.length > 0 && (
				<>
					<div className="font-mono text-[10px] text-on-surface-variant mt-4 mb-4">
						<span className="text-primary">{results.length}</span> results
						found
					</div>
					<div className="space-y-3">
						{results.map((release) => (
							<RecordSearchCard key={release.id} release={release} />
						))}
					</div>
				</>
			)}

			{/* Empty Results */}
			{searched && results.length === 0 && (
				<div className="font-mono text-sm text-on-surface-variant text-center py-8">
					no records found matching &quot;{query}&quot;
				</div>
			)}
		</div>
	);
}
