"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import {
	Dialog,
	DialogContent,
	DialogHeader,
	DialogTitle,
	DialogTrigger,
} from "@/components/ui/dialog";
import { searchRecordsAction } from "@/actions/discovery";

interface SelectedRecord {
	id: string;
	title: string;
	artist: string;
	label: string | null;
	year: number | null;
	format: string | null;
}

interface SearchResultItem {
	id: string;
	title: string;
	artist: string;
	label: string | null;
	format: string | null;
	year: number | null;
	genre: string[] | null;
	rarityScore: number | null;
	coverImageUrl: string | null;
	owners: unknown[];
	ownerCount: number;
}

interface RecordSearchInlineProps {
	onSelect: (record: SelectedRecord) => void;
	children: React.ReactNode;
}

export function RecordSearchInline({
	onSelect,
	children,
}: RecordSearchInlineProps) {
	const [open, setOpen] = useState(false);
	const [term, setTerm] = useState("");
	const [results, setResults] = useState<SearchResultItem[]>([]);
	const [isSearching, setIsSearching] = useState(false);
	const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

	const handleSearch = useCallback((value: string) => {
		setTerm(value);

		if (debounceRef.current) {
			clearTimeout(debounceRef.current);
		}

		if (value.trim().length < 2) {
			setResults([]);
			return;
		}

		debounceRef.current = setTimeout(async () => {
			setIsSearching(true);
			try {
				const data = await searchRecordsAction(value.trim());
				setResults(data as SearchResultItem[]);
			} catch {
				setResults([]);
			} finally {
				setIsSearching(false);
			}
		}, 300);
	}, []);

	// Cleanup on unmount
	useEffect(() => {
		return () => {
			if (debounceRef.current) {
				clearTimeout(debounceRef.current);
			}
		};
	}, []);

	function handleSelect(result: SearchResultItem) {
		onSelect({
			id: result.id,
			title: result.title,
			artist: result.artist,
			label: result.label,
			year: result.year,
			format: result.format,
		});
		setOpen(false);
		setTerm("");
		setResults([]);
	}

	return (
		<Dialog open={open} onOpenChange={setOpen}>
			<DialogTrigger render={<span />}>{children}</DialogTrigger>
			<DialogContent className="sm:max-w-md">
				<DialogHeader>
					<DialogTitle className="font-mono text-xs uppercase tracking-[0.2em] text-outline">
						LINK_RECORD
					</DialogTitle>
				</DialogHeader>

				{/* Search input with terminal prompt */}
				<div className="flex items-center gap-2 border-l-2 border-primary pl-2">
					<span className="font-mono text-xs text-primary">&gt;</span>
					<input
						type="text"
						value={term}
						onChange={(e) => handleSearch(e.target.value)}
						placeholder="Search records..."
						autoFocus
						className="flex-1 font-mono text-xs bg-transparent text-on-surface placeholder:text-on-surface-variant/50 outline-none"
					/>
				</div>

				{/* Results */}
				<div className="max-h-60 overflow-y-auto mt-2">
					{isSearching && (
						<div className="font-mono text-xs text-on-surface-variant py-2">
							Searching...
						</div>
					)}

					{!isSearching && results.length === 0 && term.length >= 2 && (
						<div className="font-mono text-xs text-on-surface-variant py-2">
							No records found.
						</div>
					)}

					{results.map((result) => (
						<button
							key={result.id}
							type="button"
							onClick={() => handleSelect(result)}
							className="w-full text-left px-2 py-1.5 hover:bg-surface-container-low rounded transition-colors"
						>
							<span className="font-mono text-xs text-on-surface">
								{result.title} - {result.artist}
								{result.year ? ` \u00b7 ${result.year}` : ""}
							</span>
						</button>
					))}
				</div>
			</DialogContent>
		</Dialog>
	);
}
