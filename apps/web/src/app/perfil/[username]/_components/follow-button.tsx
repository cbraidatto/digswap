"use client";

import { useOptimistic, useTransition } from "react";
import { toast } from "sonner";
import { followUser, unfollowUser } from "@/actions/social";

interface FollowButtonProps {
	targetUserId: string;
	targetUsername: string;
	initialIsFollowing: boolean;
	initialFollowerCount: number;
}

export function FollowButton({
	targetUserId,
	targetUsername,
	initialIsFollowing,
	initialFollowerCount,
}: FollowButtonProps) {
	const [isPending, startTransition] = useTransition();

	const [optimistic, setOptimistic] = useOptimistic(
		{ isFollowing: initialIsFollowing, followerCount: initialFollowerCount },
		(current, action: "follow" | "unfollow") => ({
			isFollowing: action === "follow",
			followerCount: current.followerCount + (action === "follow" ? 1 : -1),
		}),
	);

	function handleToggle() {
		startTransition(async () => {
			if (optimistic.isFollowing) {
				setOptimistic("unfollow");
				const result = await unfollowUser(targetUserId);
				if (result.error) toast.error("could not unfollow this digger. try again.");
			} else {
				setOptimistic("follow");
				const result = await followUser(targetUserId);
				if (result.error) toast.error("could not follow this digger. try again.");
			}
		});
	}

	return (
		<button
			type="button"
			onClick={handleToggle}
			disabled={isPending}
			aria-pressed={optimistic.isFollowing}
			aria-label={
				optimistic.isFollowing ? `Unfollow ${targetUsername}` : `Follow ${targetUsername}`
			}
			className={`group inline-flex items-center gap-2 font-mono text-xs uppercase tracking-wider px-4 py-2 rounded-lg transition-all h-11 md:h-8 ${
				isPending ? "opacity-50 pointer-events-none" : ""
			} ${
				optimistic.isFollowing
					? "border border-outline-variant text-on-surface-variant bg-transparent hover:border-destructive hover:text-destructive hover:bg-destructive/10"
					: "border border-primary text-primary bg-transparent hover:bg-primary/10"
			}`}
		>
			{optimistic.isFollowing ? (
				<>
					<span className="material-symbols-outlined text-[16px] group-hover:hidden">
						person_check
					</span>
					<span className="material-symbols-outlined text-[16px] hidden group-hover:inline-flex">
						person_remove
					</span>
					<span className="group-hover:hidden">FOLLOWING</span>
					<span className="hidden group-hover:inline-flex">UNFOLLOW</span>
				</>
			) : (
				<>
					<span className="material-symbols-outlined text-[16px]">person_add</span>
					<span>FOLLOW</span>
				</>
			)}
		</button>
	);
}
