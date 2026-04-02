"use client";

import { useState, useRef, useCallback, useTransition } from "react";
import Link from "next/link";
import Image from "next/image";
import { searchUsers, type SearchResult } from "@/actions/social";
import { FollowButton } from "@/app/(protected)/(profile)/perfil/[username]/_components/follow-button";

export function SearchSection() {
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
					const data = await searchUsers(value);
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
			<div className="font-mono text-xs text-on-surface-variant uppercase tracking-[0.2em] mb-4">
				search_diggers
			</div>

			{/* Search Input */}
			<div className="relative flex items-center bg-surface-container-lowest p-4 border-l-4 border-primary">
				<span className="text-primary font-mono text-xl mr-4">&gt;</span>
				<input
					type="text"
					value={query}
					onChange={handleInputChange}
					className="w-full bg-transparent border-none focus:ring-0 text-on-surface font-mono text-lg placeholder:text-on-surface-variant/40 outline-none"
					placeholder="Search by username..."
					role="searchbox"
					aria-label="Search diggers by username"
				/>
				<span className="w-3 h-8 bg-primary blink ml-2" />
			</div>

			{/* Results */}
			{searched && results.length > 0 && (
				<>
					<div className="font-mono text-xs text-on-surface-variant mt-4 mb-4">
						RESULTS: {results.length} diggers found
					</div>
					<div className="space-y-3" role="list">
						{results.map((result) => (
							<div
								key={result.id}
								role="listitem"
								className="bg-surface-container-low rounded-lg p-4 flex items-center gap-4 hover:bg-surface-container transition-colors"
							>
								{/* Avatar 40px */}
								<div className="w-10 h-10 bg-surface-container-high rounded flex items-center justify-center flex-shrink-0 overflow-hidden">
									{result.avatarUrl ? (
										<Image
											src={result.avatarUrl}
											alt={result.username || "user"}
											width={40}
											height={40}
											className="object-cover rounded"
											unoptimized
										/>
									) : (
										<span className="text-sm font-mono font-bold text-primary">
											{(result.displayName || result.username || "?")
												.charAt(0)
												.toUpperCase()}
										</span>
									)}
								</div>

								{/* Info */}
								<div className="flex-1 min-w-0">
									{result.username ? (
										<Link
											href={`/perfil/${result.username}`}
											className="font-mono text-sm text-on-surface hover:text-primary transition-colors"
										>
											{result.username}
										</Link>
									) : (
										<span className="font-mono text-sm text-on-surface-variant">
											unknown
										</span>
									)}
									<div className="font-mono text-xs text-on-surface-variant">
										{result.displayName || ""} &middot; {result.recordCount}{" "}
										records &middot; {result.followerCount} followers
									</div>
								</div>

								{/* Follow Button */}
								<FollowButton
									targetUserId={result.id}
									targetUsername={result.username || "user"}
									initialIsFollowing={result.isFollowing}
									initialFollowerCount={result.followerCount}
								/>
							</div>
						))}
					</div>
				</>
			)}

			{searched && results.length === 0 && (
				<div className="font-mono text-sm text-on-surface-variant text-center py-8">
					no diggers found matching &quot;{query}&quot;
				</div>
			)}

			{isPending && !searched && (
				<div className="font-mono text-xs text-on-surface-variant text-center py-8">
					searching...
				</div>
			)}
		</div>
	);
}
