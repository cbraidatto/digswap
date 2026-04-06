"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Image from "next/image";
import { useChatStore } from "@/lib/chat/store";
import { getMessagesAction, sendMessageAction } from "@/actions/chat";
import { createClient } from "@/lib/supabase/client";
import type { ChatMessage } from "@/lib/chat/queries";

export function ChatThread() {
	const { activeFriendId, activeFriendUsername, activeFriendAvatarUrl } = useChatStore();
	const [messages, setMessages] = useState<ChatMessage[]>([]);
	const [loading, setLoading] = useState(true);
	const [input, setInput] = useState("");
	const [sending, setSending] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const scrollRef = useRef<HTMLDivElement>(null);
	const inputRef = useRef<HTMLTextAreaElement>(null);

	// Scroll to bottom helper
	const scrollToBottom = useCallback(() => {
		if (scrollRef.current) {
			scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
		}
	}, []);

	// Load initial messages
	useEffect(() => {
		if (!activeFriendId) return;
		let cancelled = false;

		async function load() {
			setLoading(true);
			const msgs = await getMessagesAction(activeFriendId!);
			if (!cancelled) {
				setMessages(msgs);
				setLoading(false);
				// Delay scroll to allow render
				setTimeout(scrollToBottom, 50);
			}
		}
		load();
		return () => { cancelled = true; };
	}, [activeFriendId, scrollToBottom]);

	// Subscribe to realtime messages via Supabase Realtime
	useEffect(() => {
		if (!activeFriendId) return;

		const supabase = createClient();
		const channelName = `dm:${[activeFriendId].sort().join(":")}`;

		const channel = supabase
			.channel(channelName)
			.on(
				"postgres_changes",
				{
					event: "INSERT",
					schema: "public",
					table: "direct_messages",
					// Listen for messages where the current conversation partner is involved
				},
				(payload) => {
					const newRow = payload.new as {
						id: string;
						sender_id: string;
						receiver_id: string;
						body: string;
						created_at: string;
					};

					// Only add messages relevant to this conversation
					const isRelevant =
						(newRow.sender_id === activeFriendId) ||
						(newRow.receiver_id === activeFriendId);

					if (!isRelevant) return;

					// Avoid duplicates (optimistic message already in state)
					setMessages((prev) => {
						if (prev.some((m) => m.id === newRow.id)) return prev;
						return [
							...prev,
							{
								id: newRow.id,
								senderId: newRow.sender_id,
								body: newRow.body,
								createdAt: newRow.created_at,
								isOwn: newRow.receiver_id === activeFriendId,
							},
						];
					});

					setTimeout(scrollToBottom, 50);
				},
			)
			.subscribe();

		return () => {
			supabase.removeChannel(channel);
		};
	}, [activeFriendId, scrollToBottom]);

	// Send message
	async function handleSend() {
		if (!activeFriendId || !input.trim() || sending) return;

		const body = input.trim();
		setInput("");
		setSending(true);
		setError(null);

		// Optimistic insert
		const optimisticId = `optimistic-${Date.now()}`;
		const optimisticMsg: ChatMessage = {
			id: optimisticId,
			senderId: "self",
			body,
			createdAt: new Date().toISOString(),
			isOwn: true,
		};
		setMessages((prev) => [...prev, optimisticMsg]);
		setTimeout(scrollToBottom, 50);

		const result = await sendMessageAction({
			receiverId: activeFriendId,
			body,
		});

		if (!result.success) {
			// Remove optimistic message on failure
			setMessages((prev) => prev.filter((m) => m.id !== optimisticId));
			setError(result.error ?? "Failed to send.");
		} else if (result.messageId) {
			// Replace optimistic ID with real ID
			setMessages((prev) =>
				prev.map((m) => (m.id === optimisticId ? { ...m, id: result.messageId!, senderId: "" } : m)),
			);
		}

		setSending(false);
		inputRef.current?.focus();
	}

	function handleKeyDown(e: React.KeyboardEvent) {
		if (e.key === "Enter" && !e.shiftKey) {
			e.preventDefault();
			handleSend();
		}
	}

	if (!activeFriendId) return null;

	return (
		<div className="flex flex-col h-full">
			{/* Friend header */}
			<div className="flex items-center gap-2 px-4 py-2 border-b border-outline-variant/5">
				{activeFriendAvatarUrl ? (
					<Image
						src={activeFriendAvatarUrl}
						alt=""
						width={24}
						height={24}
						unoptimized
						className="w-6 h-6 rounded-full border border-outline-variant/20"
					/>
				) : (
					<div className="w-6 h-6 rounded-full bg-surface-container-high flex items-center justify-center">
						<span className="text-[10px] font-mono font-bold text-primary">
							{(activeFriendUsername?.[0] ?? "?").toUpperCase()}
						</span>
					</div>
				)}
				<span className="font-mono text-xs text-on-surface font-medium">
					{activeFriendUsername ?? "Digger"}
				</span>
			</div>

			{/* Messages */}
			<div ref={scrollRef} className="flex-1 overflow-y-auto px-3 py-3 space-y-2">
				{loading ? (
					<div className="flex items-center justify-center py-8">
						<span className="font-mono text-xs text-on-surface-variant animate-pulse">
							Loading messages...
						</span>
					</div>
				) : messages.length === 0 ? (
					<div className="text-center py-8">
						<p className="font-mono text-xs text-on-surface-variant/50">
							No messages yet — say hello!
						</p>
					</div>
				) : (
					messages.map((msg) => (
						<div
							key={msg.id}
							className={`flex ${msg.isOwn ? "justify-end" : "justify-start"}`}
						>
							<div
								className={`max-w-[85%] rounded-lg px-3 py-2 ${
									msg.isOwn
										? "bg-primary text-background"
										: "bg-surface-container-high text-on-surface"
								}`}
							>
								<p className="font-mono text-xs whitespace-pre-wrap break-words">
									{msg.body}
								</p>
								<span
									className={`font-mono text-[9px] mt-1 block ${
										msg.isOwn ? "text-background/60" : "text-on-surface-variant/40"
									}`}
								>
									{new Date(msg.createdAt).toLocaleTimeString([], {
										hour: "2-digit",
										minute: "2-digit",
									})}
								</span>
							</div>
						</div>
					))
				)}
			</div>

			{/* Error */}
			{error && (
				<div className="px-3 py-1">
					<p className="font-mono text-[10px] text-destructive">{error}</p>
				</div>
			)}

			{/* Input */}
			<div className="border-t border-outline-variant/10 px-3 py-2">
				<div className="flex items-end gap-2">
					<textarea
						ref={inputRef}
						value={input}
						onChange={(e) => setInput(e.target.value)}
						onKeyDown={handleKeyDown}
						placeholder="Type a message..."
						maxLength={2000}
						rows={1}
						className="flex-1 bg-surface-container-lowest border border-outline-variant/20 rounded px-3 py-2 font-mono text-xs text-on-surface placeholder:text-on-surface-variant/40 resize-none focus:outline-none focus:border-primary/50 max-h-20 overflow-y-auto"
					/>
					<button
						type="button"
						onClick={handleSend}
						disabled={sending || !input.trim()}
						className="bg-primary text-background rounded p-2 hover:opacity-90 disabled:opacity-30 transition-opacity flex-shrink-0"
					>
						<span className="material-symbols-outlined text-sm">send</span>
					</button>
				</div>
			</div>
		</div>
	);
}
