"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { getNotificationsAction, markNotificationRead } from "@/actions/notifications";
import type { NotificationData } from "@/components/shell/notification-row";
import { NotificationRow } from "@/components/shell/notification-row";

const PAGE_SIZE = 20;

export default function NotificationsPage() {
	const router = useRouter();
	const [notifications, setNotifications] = useState<NotificationData[]>([]);
	const [currentPage, setCurrentPage] = useState(1);
	const [totalCount, setTotalCount] = useState(0);
	const [isLoading, setIsLoading] = useState(true);

	useEffect(() => {
		let mounted = true;

		async function fetchNotifications() {
			setIsLoading(true);
			try {
				const result = await getNotificationsAction(currentPage);
				if (mounted) {
					setNotifications(
						result.items.map((n) => ({
							id: n.id,
							type: n.type,
							title: n.title,
							body: n.body,
							link: n.link,
							read: n.read,
							createdAt: n.createdAt.toISOString(),
						})),
					);
					setTotalCount(result.total);
				}
			} catch {
				// Silent fail
			} finally {
				if (mounted) {
					setIsLoading(false);
				}
			}
		}

		fetchNotifications();

		return () => {
			mounted = false;
		};
	}, [currentPage]);

	const handleNotificationClick = async (notificationId: string) => {
		const notification = notifications.find((n) => n.id === notificationId);
		if (!notification) return;

		// Mark as read
		markNotificationRead(notificationId);
		setNotifications((prev) =>
			prev.map((n) => (n.id === notificationId ? { ...n, read: true } : n)),
		);

		// Navigate if link exists
		if (notification.link) {
			router.push(notification.link);
		}
	};

	return (
		<div className="mx-auto w-full max-w-[640px] px-4 py-6">
			<h1 className="font-heading text-xl font-semibold mb-6">Notifications</h1>

			{isLoading ? (
				<div className="space-y-0">
					{Array.from({ length: 5 }).map((_, i) => (
						<div
							// biome-ignore lint/suspicious/noArrayIndexKey: static list
							key={`skeleton-${i}`}
							className="h-16 bg-surface-container-low animate-pulse border-b border-outline-variant/10"
						/>
					))}
				</div>
			) : notifications.length === 0 ? (
				<div className="text-center py-16">
					<div className="font-mono text-xs text-on-surface-variant">[NO_NOTIFICATIONS]</div>
					<div className="font-mono text-sm text-on-surface-variant mt-2">
						When someone has a record from your wantlist, you will be notified here.
					</div>
				</div>
			) : (
				<>
					<ul>
						{notifications.map((notification) => (
							<li key={notification.id} className="border-b border-outline-variant/10">
								<NotificationRow notification={notification} onClick={handleNotificationClick} />
							</li>
						))}
					</ul>

					{/* Pagination */}
					<div className="flex items-center justify-between mt-6">
						<button
							type="button"
							disabled={currentPage === 1}
							onClick={() => setCurrentPage((p) => p - 1)}
							className="font-mono text-xs text-primary hover:underline disabled:opacity-50 disabled:cursor-not-allowed"
						>
							&lt; Previous
						</button>
						<button
							type="button"
							disabled={currentPage * PAGE_SIZE >= totalCount}
							onClick={() => setCurrentPage((p) => p + 1)}
							className="font-mono text-xs text-primary hover:underline disabled:opacity-50 disabled:cursor-not-allowed"
						>
							Next &gt;
						</button>
					</div>
				</>
			)}
		</div>
	);
}
