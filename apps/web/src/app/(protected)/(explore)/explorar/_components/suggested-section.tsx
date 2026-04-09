"use client";

import { useEffect, useState, useTransition } from "react";
import { getSuggestionsAction } from "@/actions/discovery";
import { CoverArt } from "@/components/ui/cover-art";
import { GemBadge } from "@/components/ui/gem-badge";
import { PlayOverlay } from "@/components/ui/play-overlay";
import { RecordContextMenu } from "@/components/ui/record-context-menu";
import { RecordLink } from "@/components/ui/record-link";
import type { SuggestionResult } from "@/lib/discovery/queries";

export function SuggestedSection() {
	const [suggestions, setSuggestions] = useState<SuggestionResult[]>([]);
	const [loaded, setLoaded] = useState(false);
	const [isPending, startTransition] = useTransition();

	useEffect(() => {
		startTransition(async () => {
			try {
				const data = await getSuggestionsAction();
				setSuggestions(data.slice(0, 8));
			} catch {
				setSuggestions([]);
			} finally {
				setLoaded(true);
			}
		});
	}, []);

	if (loaded && suggestions.length === 0) return null;

	return (
		<section>
			<div className="flex items-center gap-2 mb-3">
				<span className="material-symbols-outlined text-sm text-secondary">auto_awesome</span>
				<span className="font-mono text-xs text-secondary uppercase tracking-[0.2em]">
					Suggested for you
				</span>
			</div>

			{isPending && !loaded && (
				<div className="grid grid-cols-2 md:grid-cols-4 gap-3">
					{Array.from({ length: 4 }).map((_, i) => (
						<div
							// biome-ignore lint/suspicious/noArrayIndexKey: static list
							key={`skel-${i}`}
							className="bg-surface-container-low rounded-xl h-48 animate-pulse"
						/>
					))}
				</div>
			)}

			{loaded && suggestions.length > 0 && (
				<div className="grid grid-cols-2 md:grid-cols-4 gap-3">
					{suggestions.map((record) => (
						<div
							key={record.id}
							className="bg-surface-container-low rounded-xl overflow-hidden border border-outline-variant/5 hover:border-outline-variant/15 hover:shadow-lg hover:shadow-black/5 transition-all group"
						>
							<RecordLink
								discogsId={record.discogsId}
								className="block relative aspect-square group/cover"
							>
								<CoverArt
									src={record.coverImageUrl}
									alt={record.title}
									size="full"
									containerClassName="w-full h-full"
								/>
								<PlayOverlay
									videoId={record.youtubeVideoId}
									title={record.title}
									artist={record.artist}
									coverUrl={record.coverImageUrl}
								/>
							</RecordLink>
							<div className="p-2.5">
								<div className="flex items-start justify-between gap-1">
									<RecordLink discogsId={record.discogsId}>
										<h3 className="font-heading text-xs font-bold text-on-surface group-hover:text-primary transition-colors line-clamp-1">
											{record.title}
										</h3>
									</RecordLink>
									<RecordContextMenu
										discogsId={record.discogsId}
										releaseId={record.id}
										title={record.title}
										artist={record.artist}
									/>
								</div>
								<p className="font-mono text-[10px] text-on-surface-variant truncate mt-0.5">
									{record.artist}
								</p>
								<div className="flex items-center justify-between mt-1.5">
									<GemBadge score={record.rarityScore} />
									<span className="font-mono text-[9px] text-on-surface-variant/50">
										{record.ownerCount} {record.ownerCount === 1 ? "owner" : "owners"}
									</span>
								</div>
							</div>
						</div>
					))}
				</div>
			)}
		</section>
	);
}
