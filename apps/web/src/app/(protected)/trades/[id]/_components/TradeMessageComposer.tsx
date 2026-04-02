"use client";

import { useRef, useState, useTransition } from "react";
import { sendTradeMessage } from "@/actions/trade-messages";

const TERMINAL_STATUSES = new Set(["completed", "declined", "cancelled", "expired"]);
const MAX_LENGTH = 2000;
const NEAR_LIMIT = 1800;

interface Props {
	tradeId: string;
	status: string;
}

export function TradeMessageComposer({ tradeId, status }: Props) {
	const [body, setBody] = useState("");
	const [error, setError] = useState<string | null>(null);
	const [isPending, startTransition] = useTransition();
	const textareaRef = useRef<HTMLTextAreaElement>(null);

	const isTerminal = TERMINAL_STATUSES.has(status);
	const isDisabled = isTerminal || isPending;
	const charsLeft = MAX_LENGTH - body.length;
	const nearLimit = body.length >= NEAR_LIMIT;

	function handleSubmit(e: React.FormEvent) {
		e.preventDefault();
		const trimmed = body.trim();
		if (!trimmed || isDisabled) return;

		setError(null);
		startTransition(async () => {
			try {
				await sendTradeMessage(tradeId, trimmed);
				setBody("");
				textareaRef.current?.focus();
			} catch (err) {
				setError(err instanceof Error ? err.message : "Failed to send message.");
			}
		});
	}

	function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
		if (e.key === "Enter" && !e.shiftKey) {
			e.preventDefault();
			handleSubmit(e as unknown as React.FormEvent);
		}
	}

	if (isTerminal) {
		return (
			<div className="border-t border-outline-variant pt-4 mt-4">
				<p className="text-muted-foreground font-mono text-xs text-center">
					This trade is {status} — messaging is closed
				</p>
			</div>
		);
	}

	return (
		<form
			onSubmit={handleSubmit}
			className="border-t border-outline-variant pt-4 mt-4"
		>
			<div className="relative">
				<textarea
					ref={textareaRef}
					value={body}
					onChange={(e) => setBody(e.target.value)}
					onKeyDown={handleKeyDown}
					disabled={isDisabled}
					maxLength={MAX_LENGTH}
					rows={3}
					placeholder="Send a message… (Enter to send, Shift+Enter for newline)"
					className="w-full bg-background border border-outline-variant rounded px-3 py-2.5 text-sm font-mono text-foreground placeholder-muted-foreground resize-none focus:outline-none focus:border-primary/40 disabled:opacity-50 disabled:cursor-not-allowed"
				/>
				{nearLimit && (
					<span
						className={`absolute bottom-2.5 right-3 font-mono text-[10px] ${
							charsLeft < 100 ? "text-destructive" : "text-muted-foreground"
						}`}
					>
						{charsLeft}
					</span>
				)}
			</div>

			{error && (
				<p className="text-destructive font-mono text-xs mt-1.5">{error}</p>
			)}

			<div className="flex justify-end mt-2">
				<button
					type="submit"
					disabled={isDisabled || !body.trim()}
					className="bg-primary hover:bg-primary disabled:bg-outline-variant disabled:text-muted-foreground text-background font-mono text-xs font-bold px-4 py-2 rounded transition-colors"
				>
					{isPending ? "Sending…" : "Send"}
				</button>
			</div>
		</form>
	);
}
