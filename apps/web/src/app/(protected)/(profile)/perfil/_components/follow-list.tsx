"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import Image from "next/image";
import { fetchFollowersList, fetchFollowingList } from "@/actions/social";
import type { FollowUser } from "@/lib/social/queries";

interface FollowListProps {
	userId: string;
	type: "followers" | "following";
	count: number;
}

export function FollowList({ userId, type, count }: FollowListProps) {
	const [expanded, setExpanded] = useState(false);
	const [users, setUsers] = useState<FollowUser[]>([]);
	const [loaded, setLoaded] = useState(false);
	const [isPending, startTransition] = useTransition();

	const listId = `follow-list-${type}`;

	function handleToggle() {
		if (!expanded && !loaded) {
			startTransition(async () => {
				const fetched =
					type === "followers"
						? await fetchFollowersList(userId)
						: await fetchFollowingList(userId);
				setUsers(fetched);
				setLoaded(true);
				setExpanded(true);
			});
		} else {
			setExpanded(!expanded);
		}
	}

	return (
		<div>
			<button
				type="button"
				onClick={handleToggle}
				aria-expanded={expanded}
				aria-controls={listId}
				className="inline-flex items-center gap-1 hover:text-primary transition-colors"
			>
				<span className="text-secondary">{count}</span>
				<span className="text-on-surface-variant">{type}</span>
			</button>

			{expanded && (
				<div
					id={listId}
					className="mt-3 bg-surface-container rounded-lg border border-outline-variant/10 max-h-64 overflow-y-auto"
				>
					{isPending ? (
						<div className="font-mono text-sm text-on-surface-variant text-center py-6">
							loading...
						</div>
					) : users.length === 0 ? (
						<div className="font-mono text-sm text-on-surface-variant text-center py-6">
							{type === "followers"
								? "no followers yet"
								: "not following anyone yet"}
						</div>
					) : (
						users.map((user) => (
							<div
								key={user.id}
								className="flex items-center gap-3 px-4 py-3 hover:bg-surface-container-high transition-colors"
							>
								{/* Avatar 24px */}
								<div className="w-6 h-6 bg-surface-container-high rounded flex items-center justify-center flex-shrink-0">
									{user.avatarUrl ? (
										<Image
											src={user.avatarUrl}
											alt={user.username || "user"}
											width={24}
											height={24}
											unoptimized
											className="w-full h-full object-cover rounded"
										/>
									) : (
										<span className="text-xs font-mono font-bold text-primary">
											{(user.displayName || user.username || "?")
												.charAt(0)
												.toUpperCase()}
										</span>
									)}
								</div>

								{/* Username */}
								{user.username ? (
									<Link
										href={`/perfil/${user.username}`}
										className="font-mono text-xs text-on-surface hover:text-primary transition-colors"
									>
										{user.username}
									</Link>
								) : (
									<span className="font-mono text-xs text-on-surface-variant">
										unknown
									</span>
								)}

								{/* Display name */}
								{user.displayName && (
									<span className="text-xs text-on-surface-variant">
										{user.displayName}
									</span>
								)}
							</div>
						))
					)}
				</div>
			)}
		</div>
	);
}
