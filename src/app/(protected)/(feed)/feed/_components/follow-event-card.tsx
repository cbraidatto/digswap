"use client";

import Link from "next/link";
import type { FeedItem } from "@/actions/social";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

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

export function FollowEventCard({ item }: { item: FeedItem }) {
	const followedUsername = (item.metadata?.username as string) ?? "unknown";

	return (
		<div className="bg-surface-container-low/50 rounded-lg px-4 py-3 flex items-center gap-3 border border-outline-variant/5">
			<Avatar size="sm">
				{item.avatarUrl && <AvatarImage src={item.avatarUrl} alt={item.username ?? ""} />}
				<AvatarFallback className="font-mono text-[10px]">
					{(item.username ?? "?")[0].toUpperCase()}
				</AvatarFallback>
			</Avatar>

			<span className="font-mono text-sm text-on-surface-variant">
				<Link
					href={`/perfil/${item.username}`}
					className="text-on-surface hover:text-primary transition-colors"
				>
					{item.username}
				</Link>
				{" started following "}
				<Link
					href={`/perfil/${followedUsername}`}
					className="text-on-surface hover:text-primary transition-colors"
				>
					{followedUsername}
				</Link>
			</span>

			<span className="font-mono text-[10px] text-outline ml-auto flex-shrink-0">
				{formatRelativeTime(item.createdAt)}
			</span>
		</div>
	);
}
