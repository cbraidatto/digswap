import Link from "next/link";

interface GroupCardProps {
	name: string;
	slug: string;
	category: string | null;
	visibility: string;
	memberCount: number;
	creatorUsername: string | null;
}

export function GroupCard({
	name,
	slug,
	category,
	visibility,
	memberCount,
	creatorUsername,
}: GroupCardProps) {
	return (
		<Link
			href={`/comunidade/${slug}`}
			className="block bg-surface-container-low border border-outline-variant/10 rounded p-4 hover:bg-surface-container transition-colors"
		>
			<div className="flex items-start justify-between gap-2">
				<h3 className="font-heading font-semibold text-sm text-on-surface">{name}</h3>
				{visibility === "private" && (
					<span className="font-mono text-xs font-semibold bg-surface-container-high text-on-surface-variant border border-outline-variant/20 px-2 py-0.5 rounded shrink-0">
						[PRIVATE]
					</span>
				)}
			</div>

			<div className="flex items-center gap-2 mt-2">
				<span className="font-mono text-xs text-on-surface-variant">
					{memberCount.toLocaleString()} members
				</span>
				{category && (
					<>
						<span className="text-outline-variant/30" aria-hidden="true">
							/
						</span>
						<span className="font-mono text-xs text-on-surface-variant">{category}</span>
					</>
				)}
			</div>

			{creatorUsername && (
				<div className="mt-2 font-mono text-xs text-on-surface-variant">
					Created by{" "}
					<span
						className="hover:text-primary transition-colors"
						onClick={(e) => {
							e.preventDefault();
							e.stopPropagation();
							window.location.href = `/perfil/${creatorUsername}`;
						}}
						onKeyDown={(e) => {
							if (e.key === "Enter" || e.key === " ") {
								e.preventDefault();
								e.stopPropagation();
								window.location.href = `/perfil/${creatorUsername}`;
							}
						}}
						role="link"
						tabIndex={0}
					>
						@{creatorUsername}
					</span>
				</div>
			)}
		</Link>
	);
}
