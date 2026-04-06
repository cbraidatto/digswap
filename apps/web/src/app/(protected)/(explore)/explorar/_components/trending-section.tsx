"use client";

import { useEffect, useState, useTransition } from "react";
import Link from "next/link";
import { getTrendingAction } from "@/actions/discovery";
import type { TrendingRecord } from "@/lib/discovery/queries";
import { CoverArt } from "@/components/ui/cover-art";
import { GemBadge } from "@/components/ui/gem-badge";
import { RecordContextMenu } from "@/components/ui/record-context-menu";

export function TrendingSection() {
	const [records, setRecords] = useState<TrendingRecord[]>([]);
	const [isPending, startTransition] = useTransition();
	const [loaded, setLoaded] = useState(false);

	useEffect(() => {
		startTransition(async () => {
			const data = await getTrendingAction();
			setRecords(data);
			setLoaded(true);
		});
	}, []);

	if (loaded && records.length === 0) return null;

	return (
		<section>
			<div className="flex items-center justify-between mb-3">
				<div className="flex items-center gap-2">
					<span className="material-symbols-outlined text-sm text-primary">trending_up</span>
					<span className="font-mono text-xs text-primary uppercase tracking-[0.2em]">
						Trending this week
					</span>
				</div>
			</div>

			{isPending && !loaded ? (
				<div className="flex gap-3 overflow-hidden">
					{Array.from({ length: 5 }).map((_, i) => (
						<div key={i} className="w-36 h-52 rounded-xl bg-surface-container-high animate-pulse flex-shrink-0" />
					))}
				</div>
			) : (
				<div className="flex gap-3 overflow-x-auto scrollbar-none pb-2">
					{records.map((record, idx) => (
						<div
							key={record.id}
							className="flex-shrink-0 w-36 bg-surface-container-low rounded-xl border border-outline-variant/5 hover:border-outline-variant/15 hover:shadow-lg hover:shadow-black/5 transition-all overflow-hidden group"
						>
							<Link
								href={record.discogsId ? `/release/${record.discogsId}` : "#"}
								className="block relative aspect-square"
							>
								<CoverArt
									src={record.coverImageUrl}
									alt={record.title}
									size="full"
									containerClassName="w-full h-full"
								/>
								<span className="absolute top-1.5 left-1.5 font-mono text-[10px] font-bold bg-surface-dim/80 text-primary px-1.5 py-0.5 rounded-full">
									#{idx + 1}
								</span>
							</Link>
							<div className="p-2.5">
								<div className="flex items-start justify-between gap-1">
									<Link href={record.discogsId ? `/release/${record.discogsId}` : "#"}>
										<h3 className="font-mono text-[10px] font-semibold text-on-surface group-hover:text-primary transition-colors line-clamp-1">
											{record.title}
										</h3>
									</Link>
									<RecordContextMenu
										discogsId={record.discogsId}
										title={record.title}
										artist={record.artist}
									/>
								</div>
								<p className="font-mono text-[9px] text-on-surface-variant truncate mt-0.5">
									{record.artist}
								</p>
								<div className="flex items-center justify-between mt-1.5">
									<span className="font-mono text-[9px] text-primary font-semibold">
										+{record.addCount}
									</span>
									<GemBadge score={record.rarityScore} className="text-[8px] px-1.5" />
								</div>
							</div>
						</div>
					))}
				</div>
			)}
		</section>
	);
}
