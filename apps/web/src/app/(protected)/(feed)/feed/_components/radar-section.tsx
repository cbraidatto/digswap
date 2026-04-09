import Image from "next/image";
import Link from "next/link";
import { AddToCrateButton } from "@/components/crates/add-to-crate-button";
import { ContextTooltip } from "@/components/digger-memory/context-tooltip";
import { LeadAction } from "@/components/digger-memory/lead-action";
import { getRadarMatches } from "@/lib/wantlist/radar-queries";

interface RadarSectionProps {
	userId: string;
}

function getRarityLabel(score: number | null): {
	label: string;
	colorClass: string;
	bgClass: string;
} {
	if (!score)
		return {
			label: "COMMON",
			colorClass: "text-on-surface-variant",
			bgClass: "bg-on-surface-variant/10",
		};
	if (score >= 80)
		return { label: "ULTRA RARE", colorClass: "text-tertiary", bgClass: "bg-tertiary/10" };
	if (score >= 50)
		return { label: "RARE", colorClass: "text-secondary", bgClass: "bg-secondary/10" };
	return { label: "COMMON", colorClass: "text-primary", bgClass: "bg-primary/10" };
}

export async function RadarSection({ userId }: RadarSectionProps) {
	const matches = await getRadarMatches(userId, { limit: 5 });

	if (matches.length === 0) {
		return (
			<div className="mb-8 p-6 bg-surface-container-low border border-outline-variant/10 rounded-2xl text-center relative overflow-hidden">
				<div className="absolute inset-0 bg-gradient-to-br from-primary/3 to-transparent" />
				<div className="relative z-10">
					<span
						className="material-symbols-outlined text-5xl text-primary/30 mb-3 block"
						style={{ fontVariationSettings: "'FILL' 1" }}
					>
						radar
					</span>
					<div className="font-mono text-xs text-primary tracking-[0.2em] uppercase mb-1">
						THE RADAR
					</div>
					<p className="font-mono text-xs text-on-surface-variant">
						No matches yet. The Radar fires when someone in the network has a record from your
						wantlist.
					</p>
				</div>
			</div>
		);
	}

	return (
		<section className="mb-8">
			{/* Section header */}
			<div className="flex items-center justify-between mb-4">
				<div className="flex items-center gap-3">
					<div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
						<span
							className="material-symbols-outlined text-xl text-primary"
							style={{ fontVariationSettings: "'FILL' 1" }}
						>
							radar
						</span>
					</div>
					<div>
						<span className="font-mono text-[10px] text-primary tracking-[0.2em] uppercase block">
							THE RADAR
						</span>
						<h2 className="font-heading text-lg font-bold text-on-surface leading-tight">
							{matches.length} match{matches.length !== 1 ? "es" : ""} found
						</h2>
					</div>
				</div>
				<Link
					href="/radar"
					className="font-mono text-xs text-primary hover:text-primary/80 flex items-center gap-1 bg-primary/8 hover:bg-primary/12 px-3 py-1.5 rounded-full transition-colors"
				>
					View all
					<span className="material-symbols-outlined text-sm">arrow_forward</span>
				</Link>
			</div>

			{/* Match cards */}
			<div className="space-y-2.5">
				{matches.map((match) => {
					const rarity = getRarityLabel(match.rarityScore);
					return (
						<div
							key={`${match.matchUserId}-${match.releaseId}`}
							className="flex items-center gap-4 p-4 bg-surface-container-low border border-outline-variant/8 rounded-xl hover:border-primary/20 hover:shadow-lg hover:shadow-primary/5 transition-all group"
						>
							{/* Avatar */}
							<Link href={`/perfil/${match.matchUsername}`} className="flex-shrink-0">
								<div className="w-11 h-11 rounded-xl bg-surface-container-high flex items-center justify-center overflow-hidden ring-2 ring-transparent group-hover:ring-primary/20 transition-all">
									{match.matchAvatarUrl ? (
										<Image
											src={match.matchAvatarUrl}
											alt={match.matchUsername ?? "user"}
											width={44}
											height={44}
											className="w-full h-full object-cover"
											unoptimized
										/>
									) : (
										<span className="font-mono text-sm font-bold text-primary">
											{(match.matchUsername ?? "?").charAt(0).toUpperCase()}
										</span>
									)}
								</div>
							</Link>

							{/* Content */}
							<div className="flex-1 min-w-0">
								<div className="flex items-center gap-2 mb-1">
									<Link
										href={`/perfil/${match.matchUsername}`}
										className="font-mono text-sm font-semibold text-on-surface hover:text-primary transition-colors"
									>
										{match.matchUsername}
									</Link>
									<ContextTooltip type="user" id={match.matchUserId} />
								</div>
								<div className="font-mono text-xs text-on-surface-variant truncate">
									has <span className="text-on-surface font-medium">{match.releaseTitle}</span>
									{match.releaseArtist && (
										<span className="text-on-surface-variant/60"> · {match.releaseArtist}</span>
									)}
								</div>
								<div className="flex items-center gap-2 mt-1.5">
									<span
										className={`font-mono text-[10px] font-semibold ${rarity.colorClass} ${rarity.bgClass} px-1.5 py-0.5 rounded`}
									>
										{rarity.label}
									</span>
									{match.overlapCount > 1 && (
										<span className="font-mono text-[10px] text-on-surface-variant/60">
											+{match.overlapCount - 1} more
										</span>
									)}
								</div>
							</div>

							{/* Actions */}
							<div className="flex items-center gap-1.5 flex-shrink-0">
								<AddToCrateButton
									releaseId={match.releaseId ?? null}
									discogsId={match.discogsId ?? null}
									title={match.releaseTitle ?? null}
									artist={match.releaseArtist ?? null}
									coverImageUrl={null}
								/>
								<LeadAction type="user" id={match.matchUserId} />
								{match.discogsId && (
									<Link
										href={`/release/${match.discogsId}`}
										className="p-1.5 rounded-lg text-on-surface-variant/50 hover:text-primary hover:bg-primary/8 transition-colors"
										title="View release page"
									>
										<span className="material-symbols-outlined text-lg">album</span>
									</Link>
								)}
								<Link
									href={`/perfil/${match.matchUsername}`}
									className="font-mono text-xs text-primary hover:bg-primary/10 px-3 py-1.5 rounded-lg transition-colors font-semibold"
								>
									VIEW
								</Link>
							</div>
						</div>
					);
				})}
			</div>
		</section>
	);
}
