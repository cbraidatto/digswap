import Link from "next/link";
import type { GroupPost } from "@/lib/community/queries";

function formatRelativeTime(dateStr: string): string {
	const diff = Date.now() - new Date(dateStr).getTime();
	const minutes = Math.floor(diff / 60_000);
	if (minutes < 1) return "now";
	if (minutes < 60) return `${minutes}m ago`;
	const hours = Math.floor(minutes / 60);
	if (hours < 24) return `${hours}h ago`;
	const days = Math.floor(hours / 24);
	return `${days}d ago`;
}

export function GroupPostCard({ post }: { post: GroupPost }) {
	return (
		<div className="py-4 flex flex-col gap-2">
			{/* Header: > username . timestamp */}
			<div className="flex items-center gap-1.5">
				<span className="font-mono text-[10px] text-primary">&gt;</span>
				<Link
					href={`/perfil/${post.username}`}
					className="font-mono text-[10px] text-on-surface hover:text-primary transition-colors"
				>
					{post.username}
				</Link>
				<span className="font-mono text-[10px] text-on-surface-variant">
					&middot;
				</span>
				<span className="font-mono text-[10px] text-on-surface-variant">
					{formatRelativeTime(post.createdAt)}
				</span>
			</div>

			{/* Post body */}
			<p className="text-sm text-on-surface leading-relaxed">
				{post.content}
			</p>

			{/* Linked record */}
			{post.releaseId && (
				<div className="flex flex-col gap-1">
					<span className="font-mono text-[10px] text-on-surface-variant">
						&#9492; LINKED:{" "}
						<span className="text-on-surface">
							{post.releaseArtist} - {post.releaseTitle}
							{(post.releaseLabel || post.releaseYear || post.releaseFormat) && (
								<>
									{" "}
									[{[post.releaseLabel, post.releaseYear, post.releaseFormat]
										.filter(Boolean)
										.join(", ")}
									]
								</>
							)}
						</span>
					</span>
					{post.releaseRarityScore !== null && (
						<span className="font-mono text-[10px] text-on-surface-variant">
							RARITY: {post.releaseRarityScore.toFixed(1)}
						</span>
					)}
				</div>
			)}
		</div>
	);
}
