import Image from "next/image";
import Link from "next/link";
import { findWhoHasRelease } from "@/lib/discovery/who-has-it";

interface WhoHasItSectionProps {
	discogsId: number;
}

const CONDITION_COLORS: Record<string, string> = {
	M: "text-emerald-400 border-emerald-400/40",
	"VG+": "text-green-400 border-green-400/40",
	VG: "text-lime-400 border-lime-400/40",
	"G+": "text-yellow-400 border-yellow-400/40",
	G: "text-orange-400 border-orange-400/40",
	F: "text-red-400 border-red-400/40",
	P: "text-on-surface-variant border-outline-variant/30",
};

export async function WhoHasItSection({ discogsId }: WhoHasItSectionProps) {
	const collectors = await findWhoHasRelease(discogsId, 20);

	if (collectors.length === 0) return null;

	return (
		<section className="space-y-3">
			{/* Header */}
			<div className="flex items-center gap-2">
				<span className="font-mono text-xs text-primary tracking-[0.2em]">WHO_HAS_THIS</span>
				<span className="font-mono text-xs text-on-surface-variant bg-surface-container-high rounded-full px-2 py-0.5">
					{collectors.length}
				</span>
			</div>

			{/* Grid of collectors */}
			<div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
				{collectors.map((collector) => {
					const initials = (collector.username ?? collector.displayName ?? "?")[0]?.toUpperCase();
					const conditionColor =
						collector.conditionGrade && CONDITION_COLORS[collector.conditionGrade]
							? CONDITION_COLORS[collector.conditionGrade]
							: "text-on-surface-variant border-outline-variant/30";

					return (
						<div
							key={collector.userId}
							className="bg-surface-container-low border border-outline-variant/10 rounded p-3 hover:border-outline-variant/30 transition-colors"
						>
							<div className="flex items-start gap-2">
								{/* Avatar */}
								{collector.avatarUrl ? (
									<Image
										src={collector.avatarUrl}
										alt={collector.username ?? "Collector"}
										width={40}
										height={40}
										unoptimized
										className="w-10 h-10 rounded object-cover shrink-0"
									/>
								) : (
									<div className="w-10 h-10 rounded bg-surface-container-high flex items-center justify-center shrink-0">
										<span className="font-mono text-[14px] text-on-surface-variant">
											{initials}
										</span>
									</div>
								)}

								<div className="min-w-0 flex-1">
									{/* Username link */}
									{collector.username ? (
										<Link
											href={`/perfil/${collector.username}`}
											className="font-mono text-xs text-on-surface hover:text-primary transition-colors block truncate"
										>
											{collector.username}
										</Link>
									) : (
										<span className="font-mono text-xs text-on-surface-variant block truncate">
											Anonymous
										</span>
									)}

									{/* Display name if different */}
									{collector.displayName && collector.displayName !== collector.username && (
										<span className="text-xs text-on-surface-variant block truncate">
											{collector.displayName}
										</span>
									)}

									{/* Condition badge */}
									{collector.conditionGrade && (
										<span
											className={`font-mono text-[9px] border rounded px-1 py-0.5 inline-block mt-1 ${conditionColor}`}
										>
											{collector.conditionGrade}
										</span>
									)}
								</div>
							</div>
						</div>
					);
				})}
			</div>
		</section>
	);
}
