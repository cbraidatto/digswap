"use client";

import { useCallback, useEffect, useState } from "react";
import { loadGenreLeaderboard, loadGlobalLeaderboard } from "@/actions/gamification";
import type { LeaderboardEntry } from "@/lib/gamification/queries";
import { GenreFilter } from "./genre-filter";
import { LeaderboardRow } from "./leaderboard-row";

interface RankingsTabProps {
	currentUserId: string;
}

export function RankingsTab({ currentUserId }: RankingsTabProps) {
	const [activeGenre, setActiveGenre] = useState<string | null>(null);
	const [entries, setEntries] = useState<LeaderboardEntry[]>([]);
	const [loading, setLoading] = useState(true);
	const [loadingMore, setLoadingMore] = useState(false);
	const [page, setPage] = useState(1);
	const [hasMore, setHasMore] = useState(false);

	const fetchLeaderboard = useCallback(
		async (genre: string | null, pageNum: number, append: boolean) => {
			try {
				const data =
					genre === null
						? await loadGlobalLeaderboard(pageNum)
						: await loadGenreLeaderboard(genre, pageNum);

				setEntries((prev) => (append ? [...prev, ...data] : data));
				setHasMore(data.length === 50);
			} finally {
				setLoading(false);
				setLoadingMore(false);
			}
		},
		[],
	);

	// Fetch on mount and when genre changes
	useEffect(() => {
		setPage(1);
		setLoading(true);
		setEntries([]);
		fetchLeaderboard(activeGenre, 1, false);
	}, [activeGenre, fetchLeaderboard]);

	const handleLoadMore = useCallback(() => {
		const nextPage = page + 1;
		setPage(nextPage);
		setLoadingMore(true);
		fetchLeaderboard(activeGenre, nextPage, true);
	}, [page, activeGenre, fetchLeaderboard]);

	const handleGenreChange = useCallback((genre: string | null) => {
		setActiveGenre(genre);
	}, []);

	const sectionLabel =
		activeGenre === null
			? "LEADERBOARD_GLOBAL"
			: `LEADERBOARD_${activeGenre.toUpperCase().replace(/[^A-Z0-9]/g, "_")}`;

	return (
		<div className="max-w-4xl mx-auto p-8 md:p-12">
			{/* Genre Filter */}
			<GenreFilter activeGenre={activeGenre} onGenreChange={handleGenreChange} disabled={loading} />

			{/* Section Header */}
			<div className="font-mono text-xs uppercase tracking-wider text-tertiary mt-6 mb-4">
				{sectionLabel}
			</div>

			{/* Loading State */}
			{loading && (
				<div className="space-y-1">
					<div className="bg-surface-container-low rounded-lg h-12 animate-pulse" />
					<div className="bg-surface-container-low rounded-lg h-12 animate-pulse" />
					<div className="bg-surface-container-low rounded-lg h-12 animate-pulse" />
				</div>
			)}

			{/* Leaderboard Rows */}
			{!loading && entries.length > 0 && (
				<ol className="space-y-1">
					{entries.map((entry) => (
						<LeaderboardRow
							key={entry.userId}
							rank={entry.globalRank}
							username={entry.username}
							title={entry.title}
							score={entry.globalScore}
							isOwnUser={entry.userId === currentUserId}
						/>
					))}
				</ol>
			)}

			{/* Empty State */}
			{!loading && entries.length === 0 && (
				<div className="text-center py-12">
					<p className="font-mono text-xs text-on-surface-variant uppercase tracking-wider">
						NO_RANKINGS_YET
					</p>
					<p className="font-mono text-xs text-outline mt-2">
						Rankings are computed every 15 minutes. Import your collection and start digging to
						appear on the leaderboard.
					</p>
				</div>
			)}

			{/* Load More */}
			{hasMore && !loading && (
				<button
					type="button"
					onClick={handleLoadMore}
					disabled={loadingMore}
					className="w-full py-3 font-mono text-xs uppercase tracking-wider text-on-surface-variant hover:text-on-surface transition-colors disabled:opacity-50"
				>
					{loadingMore ? "LOADING..." : "LOAD_MORE"}
				</button>
			)}
		</div>
	);
}
