import Image from "next/image";
import Link from "next/link";
import { getOwnersByReleaseId, getOwnerCountByReleaseId } from "@/lib/release/queries";
import { TrustStrip } from "@/components/trust/trust-strip";

interface OwnersSectionProps {
	releaseId: string;
}

export async function OwnersSection({ releaseId }: OwnersSectionProps) {
	const [owners, ownerCount] = await Promise.all([
		getOwnersByReleaseId(releaseId, 12),
		getOwnerCountByReleaseId(releaseId),
	]);

	return (
		<section className="space-y-3">
			<div className="flex items-center gap-2">
				<span className="font-mono text-xs text-primary tracking-[0.2em]">OWNERS</span>
				<span className="font-mono text-xs text-on-surface-variant bg-surface-container-high rounded-full px-2 py-0.5">
					{ownerCount}
				</span>
			</div>

			{owners.length === 0 ? (
				<p className="font-mono text-xs text-on-surface-variant">
					No diggers on DigSwap own this release yet.
				</p>
			) : (
				<>
					<div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
						{owners.map((owner, idx) => (
							<div
								key={`${owner.userId}-${idx}`}
								className="bg-surface-container-low border border-outline-variant/10 rounded p-3 hover:border-outline-variant/30 transition-colors"
							>
								<div className="flex items-start gap-2">
									{/* Avatar */}
									{owner.avatarUrl ? (
										<Image
											src={owner.avatarUrl}
											alt={owner.username ?? "User"}
											width={40}
											height={40}
											unoptimized
											className="w-10 h-10 rounded object-cover shrink-0"
										/>
									) : (
										<div className="w-10 h-10 rounded bg-surface-container-high flex items-center justify-center shrink-0">
											<span className="font-mono text-[14px] text-on-surface-variant">
												{(owner.username ?? "?")[0]?.toUpperCase()}
											</span>
										</div>
									)}

									<div className="min-w-0 flex-1">
										{/* Username */}
										{owner.username ? (
											<Link
												href={`/perfil/${owner.username}`}
												className="font-mono text-xs text-on-surface hover:text-primary transition-colors block truncate"
											>
												{owner.username}
											</Link>
										) : (
											<span className="font-mono text-xs text-on-surface-variant block truncate">
												Anonymous
											</span>
										)}

										{/* Display name if different */}
										{owner.displayName && owner.displayName !== owner.username && (
											<span className="text-xs text-on-surface-variant block truncate">
												{owner.displayName}
											</span>
										)}

										{/* Condition grade */}
										{owner.conditionGrade && (
											<span className="font-mono text-[9px] text-on-surface-variant bg-surface-container-high rounded px-1 py-0.5 inline-block mt-1">
												{owner.conditionGrade}
											</span>
										)}
									</div>
								</div>

								{/* Trust rating */}
								<div className="mt-2 overflow-hidden">
									<TrustStrip userId={owner.userId} variant="compact" />
								</div>
							</div>
						))}
					</div>

					{/* "Ver todos" link when more than 12 owners */}
					{ownerCount > 12 && (
						<div className="text-center pt-2">
							<span className="font-mono text-xs text-primary hover:underline cursor-pointer">
								VER_TODOS ({ownerCount})
							</span>
						</div>
					)}
				</>
			)}
		</section>
	);
}
