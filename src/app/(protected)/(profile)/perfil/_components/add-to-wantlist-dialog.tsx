"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { toast } from "sonner";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { searchDiscogs } from "@/actions/collection";
import { addToWantlist, searchYouTube, addToWantlistFromYouTube } from "@/actions/wantlist";

type Tab = "discogs" | "youtube";

interface DiscogsResult {
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

interface YouTubeResult {
	videoId: string;
	title: string;
	channelTitle: string;
	thumbnail: string;
}

interface AddToWantlistDialogProps {
	open: boolean;
	onOpenChange: (open: boolean) => void;
}

export function AddToWantlistDialog({ open, onOpenChange }: AddToWantlistDialogProps) {
	const router = useRouter();
	const [tab, setTab] = useState<Tab>("discogs");
	const [query, setQuery] = useState("");
	const [discogsResults, setDiscogsResults] = useState<DiscogsResult[]>([]);
	const [youtubeResults, setYoutubeResults] = useState<YouTubeResult[]>([]);
	const [isSearching, setIsSearching] = useState(false);
	const [isAdding, setIsAdding] = useState<string | null>(null);
	const [error, setError] = useState<string | null>(null);
	const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

	useEffect(() => {
		if (!open) {
			setTab("discogs");
			setQuery("");
			setDiscogsResults([]);
			setYoutubeResults([]);
			setIsSearching(false);
			setIsAdding(null);
			setError(null);
		}
	}, [open]);

	// Reset results when switching tabs
	useEffect(() => {
		setQuery("");
		setDiscogsResults([]);
		setYoutubeResults([]);
		setError(null);
		setIsSearching(false);
	}, [tab]);

	const handleSearch = useCallback((value: string, currentTab: Tab) => {
		setQuery(value);
		setError(null);

		if (debounceRef.current) clearTimeout(debounceRef.current);

		if (value.trim().length < 2) {
			setDiscogsResults([]);
			setYoutubeResults([]);
			setIsSearching(false);
			return;
		}

		setIsSearching(true);
		debounceRef.current = setTimeout(async () => {
			try {
				if (currentTab === "discogs") {
					const data = await searchDiscogs(value.trim());
					setDiscogsResults(data);
				} else {
					const data = await searchYouTube(value.trim());
					setYoutubeResults(data);
				}
			} catch {
				setError("Search failed. Please try again.");
			} finally {
				setIsSearching(false);
			}
		}, 300);
	}, []);

	useEffect(() => {
		return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
	}, []);

	const handleAddDiscogs = async (result: DiscogsResult) => {
		setIsAdding(String(result.discogsId));
		try {
			const res = await addToWantlist(result.discogsId);
			if (res.error) { toast.error(res.error); }
			else { toast.success("Added to wantlist"); onOpenChange(false); router.refresh(); }
		} catch { toast.error("Failed to add. Please try again."); }
		finally { setIsAdding(null); }
	};

	const handleAddYouTube = async (result: YouTubeResult) => {
		setIsAdding(result.videoId);
		try {
			const res = await addToWantlistFromYouTube(result.videoId, result.title, result.channelTitle, result.thumbnail);
			if (res.error) {
				toast.error(res.error);
			} else {
				if (res.existingOwners && res.existingOwners > 0) {
					toast.success(`Added! ${res.existingOwners} other${res.existingOwners > 1 ? "s are" : " is"} also hunting this`);
				} else {
					toast.success("Added! You're the first to tag this one");
				}
				onOpenChange(false);
				router.refresh();
			}
		} catch { toast.error("Failed to add. Please try again."); }
		finally { setIsAdding(null); }
	};

	const parseTitle = (title: string) => {
		const parts = title.split(" - ");
		if (parts.length >= 2) return { artist: parts[0].trim(), release: parts.slice(1).join(" - ").trim() };
		return { artist: "", release: title };
	};

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent className="sm:max-w-lg max-h-[80vh] flex flex-col">
				<DialogHeader>
					<DialogTitle className="font-heading">Add to Wantlist</DialogTitle>
					<DialogDescription className="font-mono text-xs">
						Search for records you&apos;re hunting
					</DialogDescription>
				</DialogHeader>

				{/* Tabs */}
				<div className="flex gap-1 bg-surface-container-high rounded-lg p-1">
					<button
						type="button"
						onClick={() => setTab("discogs")}
						className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-md font-mono text-[10px] uppercase tracking-widest transition-colors ${
							tab === "discogs"
								? "bg-surface-container-highest text-on-surface"
								: "text-on-surface-variant hover:text-on-surface"
						}`}
					>
						<span className="material-symbols-outlined text-sm">album</span>
						Discogs
					</button>
					<button
						type="button"
						onClick={() => setTab("youtube")}
						className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-md font-mono text-[10px] uppercase tracking-widest transition-colors ${
							tab === "youtube"
								? "bg-surface-container-highest text-on-surface"
								: "text-on-surface-variant hover:text-on-surface"
						}`}
					>
						<span className="material-symbols-outlined text-sm">play_circle</span>
						YouTube
					</button>
				</div>

				<div className="px-1">
					<Input
						placeholder={tab === "discogs" ? "Search by title or artist..." : "Search on YouTube..."}
						value={query}
						onChange={(e) => handleSearch(e.target.value, tab)}
						className="font-mono"
						autoFocus
					/>
				</div>

				<div className="flex-1 overflow-y-auto min-h-0 mt-2">
					{isSearching && (
						<div className="flex items-center justify-center py-8">
							<span className="material-symbols-outlined animate-spin text-primary">progress_activity</span>
							<span className="ml-2 text-xs font-mono text-on-surface-variant">
								Searching {tab === "discogs" ? "Discogs" : "YouTube"}...
							</span>
						</div>
					)}

					{error && (
						<div className="text-center py-6">
							<span className="text-xs font-mono text-destructive">{error}</span>
						</div>
					)}

					{/* Discogs results */}
					{tab === "discogs" && !isSearching && !error && discogsResults.length > 0 && (
						<div className="space-y-1">
							{discogsResults.map((result) => {
								const { artist, release } = parseTitle(result.title);
								const adding = isAdding === String(result.discogsId);
								return (
									<button
										key={result.discogsId}
										type="button"
										onClick={() => handleAddDiscogs(result)}
										disabled={isAdding !== null}
										className="w-full flex items-center gap-3 p-2 rounded-lg hover:bg-surface-container-high transition-colors text-left disabled:opacity-50"
									>
										<div className="w-12 h-12 rounded bg-surface-container-high flex-shrink-0 overflow-hidden">
											{result.coverImage ? (
												<Image src={result.coverImage} alt={result.title} width={48} height={48} className="w-full h-full object-cover" unoptimized />
											) : (
												<div className="w-full h-full flex items-center justify-center">
													<span className="material-symbols-outlined text-on-surface-variant text-lg">album</span>
												</div>
											)}
										</div>
										<div className="flex-1 min-w-0">
											<div className="text-sm font-medium text-on-surface truncate">{release}</div>
											{artist && <div className="text-xs text-on-surface-variant truncate">{artist}</div>}
										</div>
										<div className="flex-shrink-0 text-right">
											{adding ? (
												<span className="material-symbols-outlined animate-spin text-secondary text-sm">progress_activity</span>
											) : (
												<div className="text-[10px] font-mono text-on-surface-variant">
													{result.year && <div>{result.year}</div>}
													{result.format && <div className="text-on-surface-variant/60">{result.format}</div>}
												</div>
											)}
										</div>
									</button>
								);
							})}
						</div>
					)}

					{/* YouTube results */}
					{tab === "youtube" && !isSearching && !error && youtubeResults.length > 0 && (
						<div className="space-y-1">
							{youtubeResults.map((result) => {
								const adding = isAdding === result.videoId;
								return (
									<button
										key={result.videoId}
										type="button"
										onClick={() => handleAddYouTube(result)}
										disabled={isAdding !== null}
										className="w-full flex items-center gap-3 p-2 rounded-lg hover:bg-surface-container-high transition-colors text-left disabled:opacity-50"
									>
										<div className="w-16 h-12 rounded bg-surface-container-high flex-shrink-0 overflow-hidden">
											{result.thumbnail ? (
												<Image src={result.thumbnail} alt={result.title} width={64} height={48} className="w-full h-full object-cover" unoptimized />
											) : (
												<div className="w-full h-full flex items-center justify-center">
													<span className="material-symbols-outlined text-on-surface-variant text-lg">play_circle</span>
												</div>
											)}
										</div>
										<div className="flex-1 min-w-0">
											<div className="text-sm font-medium text-on-surface line-clamp-2 leading-snug">{result.title}</div>
											<div className="text-xs text-on-surface-variant truncate mt-0.5">{result.channelTitle}</div>
										</div>
										<div className="flex-shrink-0">
											{adding ? (
												<span className="material-symbols-outlined animate-spin text-secondary text-sm">progress_activity</span>
											) : (
												<span className="material-symbols-outlined text-on-surface-variant/40 text-lg">add_circle</span>
											)}
										</div>
									</button>
								);
							})}
						</div>
					)}

					{query.trim().length >= 2 && !isSearching && !error &&
						(tab === "discogs" ? discogsResults : youtubeResults).length === 0 && (
						<div className="text-center py-8">
							<span className="material-symbols-outlined text-on-surface-variant text-3xl block mb-2">search_off</span>
							<span className="text-xs font-mono text-on-surface-variant">No results for &ldquo;{query.trim()}&rdquo;</span>
						</div>
					)}

					{query.trim().length < 2 && !isSearching && (
						<div className="text-center py-8">
							<span className="material-symbols-outlined text-on-surface-variant/50 text-3xl block mb-2">
								{tab === "discogs" ? "album" : "play_circle"}
							</span>
							<span className="text-xs font-mono text-on-surface-variant/50">
								{tab === "youtube" && "Não ta no Discogs? Busca pelo YouTube"}
								{tab === "discogs" && "Type at least 2 characters to search"}
							</span>
						</div>
					)}
				</div>
			</DialogContent>
		</Dialog>
	);
}
