"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { toast } from "sonner";
import {
	Popover,
	PopoverContent,
	PopoverTrigger,
} from "@/components/ui/popover";
import { Separator } from "@/components/ui/separator";
import { createClient } from "@/lib/supabase/client";
import {
	getUnreadCountAction,
	getRecentNotificationsAction,
	markAllRead,
	markNotificationRead,
} from "@/actions/notifications";
import { NotificationRow } from "@/components/shell/notification-row";
import type { NotificationData } from "@/components/shell/notification-row";

interface NotificationBellProps {
	userId: string;
}

export function NotificationBell({ userId }: NotificationBellProps) {
	const router = useRouter();
	const [unreadCount, setUnreadCount] = useState(0);
	const [recentNotifications, setRecentNotifications] = useState<NotificationData[]>([]);
	const [isOpen, setIsOpen] = useState(false);

	// Fetch initial data and set up Realtime subscription
	useEffect(() => {
		let mounted = true;

		async function fetchInitial() {
			try {
				const [count, recent] = await Promise.all([
					getUnreadCountAction(),
					getRecentNotificationsAction(),
				]);
				if (mounted) {
					setUnreadCount(count);
					setRecentNotifications(
						recent.map((n) => ({
							id: n.id,
							type: n.type,
							title: n.title,
							body: n.body,
							link: n.link,
							read: n.read,
							createdAt: n.createdAt.toISOString(),
						})),
					);
				}
			} catch {
				// Silent fail on initial load
			}
		}

		fetchInitial();

		// Set up Supabase Realtime subscription
		const supabase = createClient();
		const channel = supabase
			.channel(`notifications-${userId}`)
			.on(
				"postgres_changes",
				{
					event: "INSERT",
					schema: "public",
					table: "notifications",
					filter: `user_id=eq.${userId}`,
				},
				(payload) => {
					if (!mounted) return;
					const newNotification = payload.new as {
						id: string;
						type: string | null;
						title: string;
						body: string | null;
						link: string | null;
						read: boolean;
						created_at: string;
					};
					setUnreadCount((prev) => prev + 1);
					setRecentNotifications((prev) =>
						[
							{
								id: newNotification.id,
								type: newNotification.type,
								title: newNotification.title,
								body: newNotification.body,
								link: newNotification.link,
								read: newNotification.read,
								createdAt: newNotification.created_at,
							},
							...prev,
						].slice(0, 5),
					);
				},
			)
			.subscribe();

		return () => {
			mounted = false;
			supabase.removeChannel(channel);
		};
	}, [userId]);

	const handleMarkAllRead = async () => {
		try {
			const result = await markAllRead();
			if (result.success) {
				setUnreadCount(0);
				setRecentNotifications((prev) =>
					prev.map((n) => ({ ...n, read: true })),
				);
				toast("All notifications marked as read");
			}
		} catch {
			// Silent fail
		}
	};

	const handleNotificationClick = async (notificationId: string) => {
		const notification = recentNotifications.find((n) => n.id === notificationId);
		if (!notification) return;

		// Mark as read
		markNotificationRead(notificationId);
		setRecentNotifications((prev) =>
			prev.map((n) => (n.id === notificationId ? { ...n, read: true } : n)),
		);
		setUnreadCount((prev) => Math.max(0, prev - 1));

		// Close dropdown
		setIsOpen(false);

		// Navigate if link exists
		if (notification.link) {
			router.push(notification.link);
		}
	};

	return (
		<Popover open={isOpen} onOpenChange={setIsOpen}>
			<PopoverTrigger
				aria-label="Notifications"
				aria-expanded={isOpen}
				className="relative p-2 text-on-surface-variant hover:bg-surface-bright transition-colors rounded"
			>
				<span className="material-symbols-outlined text-[20px]">notifications</span>
				{unreadCount > 0 && (
					<span
						className="absolute -top-0.5 -right-0.5 bg-destructive text-destructive-foreground text-[10px] font-mono font-semibold rounded-full min-w-[18px] h-[18px] flex items-center justify-center px-1"
						aria-label={`${unreadCount} unread notifications`}
					>
						{unreadCount > 9 ? "9+" : unreadCount}
					</span>
				)}
			</PopoverTrigger>
			<PopoverContent
				side="bottom"
				align="end"
				sideOffset={8}
				className="w-80 p-0 bg-popover ring-1 ring-foreground/10 shadow-md z-[60]"
			>
				{/* Header */}
				<div className="flex items-center justify-between p-4 border-b border-outline-variant/10">
					<span className="font-heading font-semibold text-on-surface">
						Notifications
					</span>
					{unreadCount > 0 && (
						<span className="font-mono text-[10px] text-on-surface-variant">
							({unreadCount})
						</span>
					)}
				</div>

				{/* Notification list */}
				<div role="list">
					{recentNotifications.length === 0 ? (
						<div className="p-4 text-sm text-on-surface-variant text-center font-mono">
							No notifications yet
						</div>
					) : (
						recentNotifications.map((notification, index) => (
							<div key={notification.id}>
								{index > 0 && (
									<Separator className="border-outline-variant/10" />
								)}
								<NotificationRow
									notification={notification}
									onClick={handleNotificationClick}
								/>
							</div>
						))
					)}
				</div>

				{/* Footer */}
				<div className="flex items-center justify-between p-4 border-t border-outline-variant/10">
					<button
						type="button"
						onClick={handleMarkAllRead}
						className="font-mono text-[10px] text-primary hover:underline"
					>
						Mark all read
					</button>
					<Link
						href="/notifications"
						className="font-mono text-[10px] text-secondary hover:underline"
						onClick={() => setIsOpen(false)}
					>
						View all notifications
					</Link>
				</div>
			</PopoverContent>
		</Popover>
	);
}
