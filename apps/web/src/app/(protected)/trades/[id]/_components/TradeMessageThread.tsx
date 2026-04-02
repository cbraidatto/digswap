"use client";

import { useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { TradeThreadMessage } from "@/lib/trades/messages";

function formatTime(iso: string) {
	return new Date(iso).toLocaleTimeString("en-GB", {
		hour: "2-digit",
		minute: "2-digit",
	});
}

function formatDate(iso: string) {
	return new Date(iso).toLocaleDateString("en-GB", {
		day: "2-digit",
		month: "short",
		year: "numeric",
	});
}

function SystemMessage({ message }: { message: TradeThreadMessage }) {
	return (
		<div className="flex justify-center my-3">
			<span className="text-muted-foreground font-mono text-xs italic px-3 py-1 rounded border border-outline-variant bg-background">
				{message.body}
			</span>
		</div>
	);
}

interface MessageBubbleProps {
	message: TradeThreadMessage;
	showSender: boolean;
}

function MessageBubble({ message, showSender }: MessageBubbleProps) {
	return (
		<div className={`flex flex-col gap-1 ${message.isOwn ? "items-end" : "items-start"}`}>
			{showSender && !message.isOwn && (
				<span className="text-muted-foreground font-mono text-xs px-1">
					{message.senderUsername ?? "Unknown digger"}
				</span>
			)}
			<div
				className={`max-w-[75%] px-3 py-2 rounded text-sm font-mono leading-relaxed ${
					message.isOwn
						? "bg-surface-dim border border-primary/20 text-foreground"
						: "bg-surface-container border border-outline-variant text-on-surface-variant"
				}`}
			>
				{message.body}
			</div>
			<span className="text-outline-variant font-mono text-[9px] px-1">
				{formatTime(message.createdAt)}
			</span>
		</div>
	);
}

interface Props {
	messages: TradeThreadMessage[];
	tradeId: string;
	currentUserId: string;
	counterpartyUsername: string;
	counterpartyAvatarUrl: string | null;
}

export function TradeMessageThread({
	messages: initialMessages,
	tradeId,
	currentUserId,
	counterpartyUsername,
	counterpartyAvatarUrl,
}: Props) {
	const [messages, setMessages] = useState<TradeThreadMessage[]>(initialMessages);
	const bottomRef = useRef<HTMLDivElement>(null);

	// Supabase Realtime: append new messages as they arrive
	useEffect(() => {
		const supabase = createClient();
		const channel = supabase
			.channel(`trade-messages:${tradeId}`)
			.on(
				"postgres_changes",
				{
					event: "INSERT",
					schema: "public",
					table: "trade_messages",
					filter: `trade_id=eq.${tradeId}`,
				},
				(payload) => {
					const row = payload.new as {
						id: string;
						trade_id: string;
						sender_id: string;
						kind: string;
						body: string;
						created_at: string;
					};
					setMessages((prev) => {
						// Deduplicate — optimistic inserts may already be in the list
						if (prev.some((m) => m.id === row.id)) return prev;
						const isOwn = row.sender_id === currentUserId;
						const newMessage: TradeThreadMessage = {
							body: row.body,
							createdAt: row.created_at,
							id: row.id,
							isOwn,
							kind: row.kind === "system" ? "system" : "user",
							senderAvatarUrl: isOwn ? null : counterpartyAvatarUrl,
							senderId: row.sender_id,
							senderUsername: isOwn ? null : counterpartyUsername,
							tradeId: row.trade_id,
						};
						return [...prev, newMessage];
					});
				},
			)
			.subscribe();

		return () => {
			void supabase.removeChannel(channel);
		};
	}, [tradeId, currentUserId, counterpartyUsername, counterpartyAvatarUrl]);

	useEffect(() => {
		bottomRef.current?.scrollIntoView({ behavior: "instant" });
	}, [messages.length]);

	if (messages.length === 0) {
		return (
			<div className="flex-1 flex items-center justify-center py-12">
				<p className="text-muted-foreground font-mono text-xs">
					No messages yet. Start the conversation.
				</p>
			</div>
		);
	}

	// Group messages by date for date separators
	const groups: Array<{ date: string; messages: TradeThreadMessage[] }> = [];
	for (const msg of messages) {
		const date = formatDate(msg.createdAt);
		const last = groups[groups.length - 1];
		if (last && last.date === date) {
			last.messages.push(msg);
		} else {
			groups.push({ date, messages: [msg] });
		}
	}

	return (
		<div className="flex flex-col gap-1 py-4 overflow-y-auto">
			{groups.map((group) => (
				<div key={group.date}>
					{/* Date separator */}
					<div className="flex items-center gap-3 my-4">
						<div className="flex-1 h-px bg-outline-variant" />
						<span className="text-muted-foreground font-mono text-xs">{group.date}</span>
						<div className="flex-1 h-px bg-outline-variant" />
					</div>

					<div className="flex flex-col gap-2">
						{group.messages.map((msg, i) => {
							if (msg.kind === "system") {
								return <SystemMessage key={msg.id} message={msg} />;
							}
							const prev = group.messages[i - 1];
							const showSender = !prev || prev.senderId !== msg.senderId || prev.kind === "system";
							return <MessageBubble key={msg.id} message={msg} showSender={showSender} />;
						})}
					</div>
				</div>
			))}
			<div ref={bottomRef} />
		</div>
	);
}
