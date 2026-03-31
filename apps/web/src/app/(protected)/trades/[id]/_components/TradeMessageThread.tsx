"use client";

import { useEffect, useRef } from "react";
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
			<span className="text-[#4a4035] font-mono text-[10px] italic px-3 py-1 rounded border border-[#2a2218] bg-[#0a0a0a]">
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
				<span className="text-[#4a4035] font-mono text-[10px] px-1">
					{message.senderUsername ?? "Unknown digger"}
				</span>
			)}
			<div
				className={`max-w-[75%] px-3 py-2 rounded text-sm font-mono leading-relaxed ${
					message.isOwn
						? "bg-[#1a1208] border border-[#c8914a]/20 text-[#e8dcc8]"
						: "bg-[#111008] border border-[#2a2218] text-[#c8c0b0]"
				}`}
			>
				{message.body}
			</div>
			<span className="text-[#2a2218] font-mono text-[9px] px-1">
				{formatTime(message.createdAt)}
			</span>
		</div>
	);
}

interface Props {
	messages: TradeThreadMessage[];
}

export function TradeMessageThread({ messages }: Props) {
	const bottomRef = useRef<HTMLDivElement>(null);

	useEffect(() => {
		bottomRef.current?.scrollIntoView({ behavior: "instant" });
	}, [messages.length]);

	if (messages.length === 0) {
		return (
			<div className="flex-1 flex items-center justify-center py-12">
				<p className="text-[#4a4035] font-mono text-xs">
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
						<div className="flex-1 h-px bg-[#2a2218]" />
						<span className="text-[#4a4035] font-mono text-[10px]">{group.date}</span>
						<div className="flex-1 h-px bg-[#2a2218]" />
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
