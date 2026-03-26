import Link from "next/link";
import type { GroupPost } from "@/lib/community/queries";
import { StarRating } from "@/components/ui/star-rating";

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

export function ReviewPostCard({ post }: { post: GroupPost }) {
	return (
		<div className="bg-surface-container border border-outline-variant/10 rounded p-4">
			{/* Header: > username . timestamp . review . */}
			<div className="flex items-center gap-1.5 mb-2">
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
				<span className="font-mono text-[10px] text-on-surface-variant">
					&middot; review &middot;
				</span>
			</div>

			{/* Stars + record title */}
			<div className="flex items-center gap-2 mb-2">
				{post.reviewRating !== null && (
					<StarRating rating={post.reviewRating} />
				)}
				{post.releaseTitle && (
					<span className="font-heading font-semibold text-sm text-on-surface">
						{post.releaseArtist} - {post.releaseTitle}
					</span>
				)}
			</div>

			{/* Pressing details */}
			{post.reviewIsPressingSpecific && post.reviewPressingDetails && (
				<p className="font-mono text-[10px] text-on-surface-variant mb-2">
					Pressing: {post.reviewPressingDetails}
				</p>
			)}

			{/* Review body */}
			<p className="text-sm text-on-surface leading-relaxed">
				{post.content}
			</p>
		</div>
	);
}
