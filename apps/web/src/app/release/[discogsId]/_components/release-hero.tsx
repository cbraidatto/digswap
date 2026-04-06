import Image from "next/image";
import { Badge } from "@/components/ui/badge";
import { GemBadge } from "@/components/ui/gem-badge";

interface ReleaseHeroProps {
	release: {
		title: string;
		artist: string;
		year: number | null;
		genre: string[] | null;
		style: string[] | null;
		format: string | null;
		label: string | null;
		country: string | null;
		coverImageUrl: string | null;
		discogsId: number | null;
		rarityScore: number | null;
		discogsHave: number;
		discogsWant: number;
	};
}

export function ReleaseHero({ release }: ReleaseHeroProps) {
	// Build metadata fragments — only show non-null fields
	const metaParts = [
		release.year ? String(release.year) : null,
		release.format,
		release.label,
		release.country,
	].filter(Boolean);

	return (
		<div className="flex flex-col md:flex-row gap-6">
			{/* Cover art */}
			<div className="shrink-0">
				{release.coverImageUrl ? (
					<Image
						src={release.coverImageUrl}
						alt={release.title}
						width={300}
						height={300}
						className="aspect-square rounded-lg object-cover"
						priority
					/>
				) : (
					<div className="w-[300px] h-[300px] rounded-lg bg-surface-container-high flex items-center justify-center">
						<span className="material-symbols-outlined text-on-surface-variant/40 text-6xl">
							album
						</span>
					</div>
				)}
			</div>

			{/* Text content */}
			<div className="flex flex-col gap-3 min-w-0">
				<h1 className="font-heading text-2xl font-bold text-on-surface">{release.title}</h1>
				<p className="text-lg text-on-surface-variant">{release.artist}</p>

				{/* Metadata row */}
				{metaParts.length > 0 && (
					<p className="font-mono text-xs text-on-surface-variant">
						{metaParts.join(" / ")}
					</p>
				)}

				{/* Genre chips */}
				{release.genre && release.genre.length > 0 && (
					<div className="flex flex-wrap gap-1.5">
						{release.genre.map((g) => (
							<Badge key={g} variant="outline" className="text-xs">
								{g}
							</Badge>
						))}
					</div>
				)}

				{/* Gem badge */}
				<div>
					<GemBadge score={release.rarityScore} showScore={true} />
				</div>

				{/* Discogs stats */}
				<p className="font-mono text-xs text-on-surface-variant">
					HAVE: {release.discogsHave} / WANT: {release.discogsWant}
				</p>

				{/* Discogs link */}
				{release.discogsId != null && (
					<a
						href={`https://www.discogs.com/release/${release.discogsId}`}
						target="_blank"
						rel="noopener noreferrer"
						className="inline-flex items-center gap-1 font-mono text-xs text-primary hover:underline"
					>
						VIEW_ON_DISCOGS
						<span className="material-symbols-outlined text-[12px]">open_in_new</span>
					</a>
				)}
			</div>
		</div>
	);
}
