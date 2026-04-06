"use client";

import { useEffect, useState, useTransition } from "react";
import Link from "next/link";
import { getTrendingAction } from "@/actions/discovery";
import type { TrendingRecord } from "@/lib/discovery/queries";
import { CoverArt } from "@/components/ui/cover-art";
import { getRarityTier } from "@/lib/collection/rarity";

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
						TRENDING THIS WEEK
					</span>
				</div>
			</div>

			{isPending && !loaded ? (
				<div className="flex gap-3 overflow-hidden">
					{Array.from({ length: 5 }).map((_, i) => (
						<div key={i} className="w-32 h-40 rounded bg-surface-container-high animate-pulse flex-shrink-0" />
					))}
				</div>
			) : (
				<div className="flex gap-3 overflow-x-auto scrollbar-none pb-2">
					{records.map((record, idx) => {
						const tier = getRarityTier(record.rarityScore);
						return (
							<Link
								key={record.id}
								href={record.discogsId ? `/release/${record.discogsId}` : "#"}
								className="flex-shrink-0 w-32 bg-surface-container-low rounded border border-outline-variant/10 hover:border-primary/20 transition-colors overflow-hidden group"
							>
								<div className="relative">
									<CoverArt
										src={record.coverImageUrl}
										alt={record.title}
										size="md"
									/>
									<span className="absolute top-1 left-1 font-mono text-[9px] bg-surface-dim/80 text-primary px-1.5 py-0.5 rounded">
										#{idx + 1}
									</span>
								</div>
								<div className="p-2">
									<p className="font-mono text-[10px] text-on-surface truncate group-hover:text-primary transition-colors">
										{record.title}
									</p>
									<p className="font-mono text-[9px] text-on-surface-variant truncate">
										{record.artist}
									</p>
									<div className="flex items-center gap-1.5 mt-1">
										<span className="font-mono text-[9px] text-primary">
											+{record.addCount} this week
										</span>
										{tier && (
											<span className="font-mono text-[8px] text-on-surface-variant">
												[{tier.toUpperCase()}]
											</span>
										)}
									</div>
								</div>
							</Link>
						);
					})}
				</div>
			)}
		</section>
	);
}
