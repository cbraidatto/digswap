"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { useChatStore } from "@/lib/chat/store";
import { getFriendsAction, getConversationsAction } from "@/actions/chat";
import type { Friend, ConversationPreview } from "@/lib/chat/queries";

function formatRelativeTime(iso: string) {
	const diff = Date.now() - new Date(iso).getTime();
	const mins = Math.floor(diff / 60_000);
	if (mins < 1) return "now";
	if (mins < 60) return `${mins}m`;
	const hrs = Math.floor(mins / 60);
	if (hrs < 24) return `${hrs}h`;
	return `${Math.floor(hrs / 24)}d`;
}

function Avatar({ url, name }: { url: string | null; name: string | null }) {
	if (url) {
		return (
			<Image
				src={url}
				alt=""
				width={32}
				height={32}
				unoptimized
				className="w-8 h-8 rounded-full border border-outline-variant/20 flex-shrink-0"
			/>
		);
	}
	return (
		<div className="w-8 h-8 rounded-full bg-surface-container-high border border-outline-variant/20 flex items-center justify-center flex-shrink-0">
			<span className="text-xs font-mono font-bold text-primary">
				{(name?.[0] ?? "?").toUpperCase()}
			</span>
		</div>
	);
}

export function ChatConversationList() {
	const [conversations, setConversations] = useState<ConversationPreview[]>([]);
	const [friends, setFriends] = useState<Friend[]>([]);
	const [loading, setLoading] = useState(true);
	const [tab, setTab] = useState<"recent" | "friends">("recent");
	const { openConversation } = useChatStore();

	useEffect(() => {
		let cancelled = false;
		async function load() {
			setLoading(true);
			const [convos, friendList] = await Promise.all([
				getConversationsAction(),
				getFriendsAction(),
			]);
			if (!cancelled) {
				setConversations(convos);
				setFriends(friendList);
				setLoading(false);
			}
		}
		load();
		return () => { cancelled = true; };
	}, []);

	// Friends without an existing conversation (for starting new chats)
	const conversationFriendIds = new Set(conversations.map((c) => c.friendId));
	const newFriends = friends.filter((f) => !conversationFriendIds.has(f.id));

	return (
		<div className="flex flex-col h-full">
			{/* Tab switcher */}
			<div className="flex border-b border-outline-variant/10">
				<button
					type="button"
					onClick={() => setTab("recent")}
					className={`flex-1 py-2 font-mono text-xs text-center transition-colors ${
						tab === "recent"
							? "text-primary border-b-2 border-primary"
							: "text-on-surface-variant hover:text-on-surface"
					}`}
				>
					Recent
				</button>
				<button
					type="button"
					onClick={() => setTab("friends")}
					className={`flex-1 py-2 font-mono text-xs text-center transition-colors ${
						tab === "friends"
							? "text-primary border-b-2 border-primary"
							: "text-on-surface-variant hover:text-on-surface"
					}`}
				>
					Friends ({friends.length})
				</button>
			</div>

			{/* Content */}
			<div className="flex-1 overflow-y-auto">
				{loading ? (
					<div className="flex items-center justify-center py-12">
						<span className="font-mono text-xs text-on-surface-variant animate-pulse">
							Loading...
						</span>
					</div>
				) : tab === "recent" ? (
					conversations.length === 0 ? (
						<div className="text-center py-12 px-4">
							<span className="material-symbols-outlined text-3xl text-on-surface-variant/30 block mb-2">
								chat_bubble
							</span>
							<p className="font-mono text-xs text-on-surface-variant">No conversations yet</p>
							<p className="font-mono text-[10px] text-on-surface-variant/50 mt-1">
								Start chatting with a mutual follower
							</p>
						</div>
					) : (
						<div className="divide-y divide-outline-variant/5">
							{conversations.map((convo) => (
								<button
									key={convo.friendId}
									type="button"
									onClick={() =>
										openConversation(
											convo.friendId,
											convo.friendUsername ?? convo.friendDisplayName,
											convo.friendAvatarUrl,
										)
									}
									className="w-full flex items-center gap-3 px-4 py-3 hover:bg-surface-container-high transition-colors text-left"
								>
									<Avatar url={convo.friendAvatarUrl} name={convo.friendUsername} />
									<div className="flex-1 min-w-0">
										<div className="flex items-center justify-between">
											<span className="font-mono text-xs text-on-surface truncate">
												{convo.friendUsername ?? convo.friendDisplayName ?? "Digger"}
											</span>
											<span className="font-mono text-[10px] text-on-surface-variant/50 flex-shrink-0 ml-2">
												{formatRelativeTime(convo.lastMessageAt)}
											</span>
										</div>
										<p className="font-mono text-[10px] text-on-surface-variant truncate mt-0.5">
											{convo.lastMessageBody}
										</p>
									</div>
								</button>
							))}
						</div>
					)
				) : (
					/* Friends tab */
					friends.length === 0 ? (
						<div className="text-center py-12 px-4">
							<span className="material-symbols-outlined text-3xl text-on-surface-variant/30 block mb-2">
								group
							</span>
							<p className="font-mono text-xs text-on-surface-variant">No mutual followers yet</p>
							<p className="font-mono text-[10px] text-on-surface-variant/50 mt-1">
								Follow other diggers — when they follow back, they appear here
							</p>
						</div>
					) : (
						<div className="divide-y divide-outline-variant/5">
							{friends.map((friend) => (
								<button
									key={friend.id}
									type="button"
									onClick={() =>
										openConversation(
											friend.id,
											friend.username ?? friend.displayName,
											friend.avatarUrl,
										)
									}
									className="w-full flex items-center gap-3 px-4 py-3 hover:bg-surface-container-high transition-colors text-left"
								>
									<Avatar url={friend.avatarUrl} name={friend.username} />
									<div className="flex-1 min-w-0">
										<span className="font-mono text-xs text-on-surface truncate block">
											{friend.username ?? friend.displayName ?? "Digger"}
										</span>
										{friend.displayName && friend.username && (
											<span className="font-mono text-[10px] text-on-surface-variant/50 truncate block">
												{friend.displayName}
											</span>
										)}
									</div>
									<span className="material-symbols-outlined text-sm text-on-surface-variant/30">
										chat
									</span>
								</button>
							))}
						</div>
					)
				)}
			</div>
		</div>
	);
}
