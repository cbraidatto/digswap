import Link from "next/link";
import { CoverArt } from "@/components/ui/cover-art";
import { RarityPill } from "@/components/ui/rarity-pill";
import { getSimilarRecords } from "@/lib/release/similar";

interface SimilarSectionProps {
	releaseId: string;
}

export async function SimilarSection({ releaseId }: SimilarSectionProps) {
	const similar = await getSimilarRecords(releaseId, 8);

	if (similar.length === 0) return null;

	return (
		<section className="space-y-3">
			<div className="flex items-center gap-2">
				<span className="material-symbols-outlined text-sm text-secondary">auto_awesome</span>
				<span className="font-mono text-xs text-secondary tracking-[0.2em]">SIMILAR RECORDS</span>
			</div>

			<div className="flex gap-3 overflow-x-auto scrollbar-none pb-2">
				{similar.map((record) => (
					<Link
						key={record.id}
						href={record.discogsId ? `/release/${record.discogsId}` : "#"}
						className="flex-shrink-0 w-32 bg-surface-container-low rounded-xl border border-outline-variant/5 hover:border-outline-variant/15 hover:shadow-lg transition-all overflow-hidden group"
					>
						<div className="aspect-square relative">
							<CoverArt
								src={record.coverImageUrl}
								alt={record.title}
								size="full"
								containerClassName="w-full h-full"
							/>
						</div>
						<div className="p-2">
							<p className="font-mono text-[10px] font-semibold text-on-surface group-hover:text-primary transition-colors line-clamp-1">
								{record.title}
							</p>
							<p className="font-mono text-[9px] text-on-surface-variant truncate">
								{record.artist}
							</p>
							<div className="mt-1">
								<RarityPill
									score={record.rarityScore}
									showScore={false}
									className="text-[8px] px-1.5"
								/>
							</div>
						</div>
					</Link>
				))}
			</div>
		</section>
	);
}
