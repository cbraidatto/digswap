"use client";

import Link from "next/link";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import type { FeedItem } from "@/lib/social/types";

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
		<div className="bg-surface-container-low/60 rounded-xl px-5 py-3.5 flex items-center gap-3.5 border border-outline-variant/8 hover:border-outline-variant/15 transition-all">
			<div className="w-8 h-8 rounded-lg bg-secondary/10 flex items-center justify-center flex-shrink-0">
				<span
					className="material-symbols-outlined text-base text-secondary"
					style={{ fontVariationSettings: "'FILL' 1" }}
				>
					person_add
				</span>
			</div>

			<Avatar size="sm">
				{item.avatarUrl && <AvatarImage src={item.avatarUrl} alt={item.username ?? ""} />}
				<AvatarFallback className="font-mono text-xs">
					{(item.username ?? "?")[0].toUpperCase()}
				</AvatarFallback>
			</Avatar>

			<span className="font-mono text-sm text-on-surface-variant flex-1 min-w-0">
				<Link
					href={`/perfil/${item.username}`}
					className="text-on-surface font-semibold hover:text-primary transition-colors"
				>
					{item.username}
				</Link>
				{" followed "}
				<Link
					href={`/perfil/${followedUsername}`}
					className="text-on-surface font-semibold hover:text-primary transition-colors"
				>
					{followedUsername}
				</Link>
			</span>

			<span className="font-mono text-[11px] text-on-surface-variant/40 flex-shrink-0">
				{formatRelativeTime(item.createdAt)}
			</span>
		</div>
	);
}
