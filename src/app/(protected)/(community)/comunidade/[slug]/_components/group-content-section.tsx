"use client";

import { useRef, useCallback } from "react";
import type { GroupPost } from "@/lib/community/queries";
import { GroupComposer } from "./group-composer";
import { GroupPostFeed } from "./group-post-feed";

interface GroupContentSectionProps {
	groupId: string;
	groupName: string;
	isMember: boolean;
	initialPosts: GroupPost[];
}

export function GroupContentSection({
	groupId,
	groupName,
	isMember,
	initialPosts,
}: GroupContentSectionProps) {
	// Use a ref-based callback pattern so the composer can prepend posts to the feed
	const prependPostRef = useRef<((post: GroupPost) => void) | null>(null);

	const handlePostCreated = useCallback((post: GroupPost) => {
		prependPostRef.current?.(post);
	}, []);

	return (
		<>
			{isMember && (
				<GroupComposer
					groupId={groupId}
					groupName={groupName}
					onPostCreated={handlePostCreated}
				/>
			)}

			<GroupPostFeed
				groupId={groupId}
				initialPosts={initialPosts}
			/>
		</>
	);
}
