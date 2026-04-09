"use client";

import { cn } from "@/lib/utils";

export interface NotificationData {
	id: string;
	type: string | null;
	title: string;
	body: string | null;
	link: string | null;
	read: boolean;
	createdAt: string;
	metadata?: {
		matchUserId?: string;
		releaseId?: string;
		[key: string]: unknown;
	} | null;
}

interface NotificationRowProps {
	notification: NotificationData;
	onClick?: (id: string) => void;
}

function getRelativeTime(dateStr: string): string {
	const now = Date.now();
	const then = Date.parse(dateStr);
	const diffMs = now - then;

	if (diffMs < 0) return "just now";

	const seconds = Math.floor(diffMs / 1000);
	if (seconds < 60) return "just now";

	const minutes = Math.floor(seconds / 60);
	if (minutes < 60) return `${minutes} min ago`;

	const hours = Math.floor(minutes / 60);
	if (hours < 24) return `${hours}h ago`;

	const days = Math.floor(hours / 24);
	if (days < 30) return `${days}d ago`;

	const months = Math.floor(days / 30);
	return `${months}mo ago`;
}

function getTypeIcon(type: string | null): { icon: string; className: string } {
	switch (type) {
		case "wantlist_match":
			return { icon: "playlist_add_check", className: "text-primary text-lg" };
		case "trade_request":
			return { icon: "swap_horiz", className: "text-on-surface-variant text-lg" };
		case "ranking_change":
			return { icon: "trending_up", className: "text-on-surface-variant text-lg" };
		case "new_badge":
			return { icon: "military_tech", className: "text-on-surface-variant text-lg" };
		case "gem_tier_change":
			return { icon: "diamond", className: "text-primary text-lg" };
		default:
			return { icon: "notifications", className: "text-on-surface-variant text-lg" };
	}
}

export function NotificationRow({ notification, onClick }: NotificationRowProps) {
	const { icon, className: iconClassName } = getTypeIcon(notification.type);
	const relativeTime = getRelativeTime(notification.createdAt);

	return (
		<button
			type="button"
			className={cn(
				"flex gap-3 p-4 cursor-pointer hover:bg-surface-container-high transition-colors w-full text-left",
				!notification.read && "border-l-2 border-primary",
			)}
			onClick={() => onClick?.(notification.id)}
		>
			<span className={cn("material-symbols-outlined shrink-0 mt-0.5", iconClassName)}>{icon}</span>
			<div className="flex flex-col gap-0.5 min-w-0 flex-1">
				<div className="text-sm font-semibold text-on-surface">{notification.title}</div>
				{notification.body && (
					<div className="text-sm text-on-surface-variant line-clamp-1">{notification.body}</div>
				)}
				<div className="font-mono text-xs text-on-surface-variant">{relativeTime}</div>
			</div>
		</button>
	);
}
