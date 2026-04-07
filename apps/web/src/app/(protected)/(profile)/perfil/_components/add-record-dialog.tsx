"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { addRecordToCollection, searchDiscogs } from "@/actions/collection";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";

interface SearchResult {
	discogsId: number;
	title: string;
	coverImage: string | null;
	year: string | null;
	format: string | null;
	genre: string[];
	country: string | null;
	have: number;
	want: number;
}

interface AddRecordDialogProps {
	open: boolean;
	onOpenChange: (open: boolean) => void;
}

export function AddRecordDialog({ open, onOpenChange }: AddRecordDialogProps) {
	const router = useRouter();
	const [query, setQuery] = useState("");
	const [results, setResults] = useState<SearchResult[]>([]);
	const [isSearching, setIsSearching] = useState(false);
	const [isAdding, setIsAdding] = useState<number | null>(null);
	const [error, setError] = useState<string | null>(null);
	const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

	// Clear state when dialog closes
	useEffect(() => {
		if (!open) {
			setQuery("");
			setResults([]);
			setIsSearching(false);
			setIsAdding(null);
			setError(null);
		}
	}, [open]);

	// Debounced search
	const handleSearch = useCallback((value: string) => {
		setQuery(value);
		setError(null);

		if (debounceRef.current) {
			clearTimeout(debounceRef.current);
		}

		if (value.trim().length < 2) {
			setResults([]);
			setIsSearching(false);
			return;
		}

		setIsSearching(true);

		debounceRef.current = setTimeout(async () => {
			try {
				const data = await searchDiscogs(value.trim());
				setResults(data);
			} catch (_err) {
				setError("Search failed. Please try again.");
				setResults([]);
			} finally {
				setIsSearching(false);
			}
		}, 300);
	}, []);

	// Clean up timeout on unmount
	useEffect(() => {
		return () => {
			if (debounceRef.current) {
				clearTimeout(debounceRef.current);
			}
		};
	}, []);

	const handleAddRecord = async (result: SearchResult) => {
		setIsAdding(result.discogsId);
		setError(null);

		try {
			const response = await addRecordToCollection(result.discogsId);

			if ("error" in response && response.error) {
				toast.error(response.error);
			} else {
				toast.success("Record added to collection");
				onOpenChange(false);
				router.refresh();
			}
		} catch (_err) {
			toast.error("Failed to add record. Please try again.");
		} finally {
			setIsAdding(null);
		}
	};

	// Split title into artist and release title (Discogs format: "Artist - Title")
	const parseTitle = (title: string) => {
		const parts = title.split(" - ");
		if (parts.length >= 2) {
			return { artist: parts[0].trim(), release: parts.slice(1).join(" - ").trim() };
		}
		return { artist: "", release: title };
	};

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent className="sm:max-w-lg max-h-[80vh] flex flex-col">
				<DialogHeader>
					<DialogTitle className="font-heading">Add Record</DialogTitle>
					<DialogDescription className="font-mono text-xs">
						Search Discogs to find a release
					</DialogDescription>
				</DialogHeader>
				<div className="px-1">
					<Input
						placeholder="Search by title or artist..."
						value={query}
						onChange={(e) => handleSearch(e.target.value)}
						className="font-mono"
						autoFocus
					/>
				</div>
				<div className="flex-1 overflow-y-auto min-h-0 mt-2">
					{isSearching && (
						<div className="flex items-center justify-center py-8">
							<span className="material-symbols-outlined animate-spin text-primary">
								progress_activity
							</span>
							<span className="ml-2 text-xs font-mono text-on-surface-variant">
								Searching Discogs...
							</span>
						</div>
					)}

					{error && (
						<div className="text-center py-6">
							<span className="text-xs font-mono text-destructive">{error}</span>
						</div>
					)}

					{!isSearching && !error && results.length > 0 && (
						<div className="space-y-1">
							{results.map((result) => {
								const { artist, release } = parseTitle(result.title);
								const adding = isAdding === result.discogsId;

								return (
									<button
										key={result.discogsId}
										type="button"
										onClick={() => handleAddRecord(result)}
										disabled={isAdding !== null}
										className="w-full flex items-center gap-3 p-2 rounded-lg hover:bg-surface-container-high transition-colors text-left disabled:opacity-50"
									>
										<div className="w-12 h-12 rounded bg-surface-container-high flex-shrink-0 overflow-hidden">
											{result.coverImage ? (
												<Image
													src={result.coverImage}
													alt={result.title}
													width={48}
													height={48}
													className="w-full h-full object-cover"
													unoptimized
												/>
											) : (
												<div className="w-full h-full flex items-center justify-center">
													<span className="material-symbols-outlined text-on-surface-variant text-lg">
														album
													</span>
												</div>
											)}
										</div>
										<div className="flex-1 min-w-0">
											<div className="text-sm font-medium text-on-surface truncate">{release}</div>
											{artist && (
												<div className="text-xs text-on-surface-variant truncate">{artist}</div>
											)}
										</div>
										<div className="flex-shrink-0 text-right">
											{adding ? (
												<span className="material-symbols-outlined animate-spin text-primary text-sm">
													progress_activity
												</span>
											) : (
												<div className="text-xs font-mono text-on-surface-variant">
													{result.year && <div>{result.year}</div>}
													{result.format && (
														<div className="text-on-surface-variant/60">{result.format}</div>
													)}
												</div>
											)}
										</div>
									</button>
								);
							})}
						</div>
					)}

					{query.trim().length >= 2 && !isSearching && !error && results.length === 0 && (
						<div className="text-center py-8">
							<span className="material-symbols-outlined text-on-surface-variant text-3xl block mb-2">
								search_off
							</span>
							<span className="text-xs font-mono text-on-surface-variant">
								No results found for &ldquo;{query.trim()}&rdquo;
							</span>
						</div>
					)}

					{query.trim().length < 2 && !isSearching && results.length === 0 && (
						<div className="text-center py-8">
							<span className="material-symbols-outlined text-on-surface-variant/50 text-3xl block mb-2">
								search
							</span>
							<span className="text-xs font-mono text-on-surface-variant/50">
								Type at least 2 characters to search
							</span>
						</div>
					)}
				</div>
			</DialogContent>
		</Dialog>
	);
}
