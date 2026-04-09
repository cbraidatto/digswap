"use client";

import { useEffect, useRef } from "react";
import { useChatStore } from "@/lib/chat/store";
import { ChatConversationList } from "./chat-conversation-list";
import { ChatThread } from "./chat-thread";

export function ChatSidebar() {
	const { isOpen, close, activeFriendId } = useChatStore();
	const panelRef = useRef<HTMLElement>(null);

	// Focus trap: keep Tab within the sidebar when open
	useEffect(() => {
		if (!isOpen || !panelRef.current) return;

		function handleKeyDown(e: KeyboardEvent) {
			if (e.key === "Escape") {
				close();
				return;
			}
			if (e.key !== "Tab" || !panelRef.current) return;

			const focusable = panelRef.current.querySelectorAll<HTMLElement>(
				'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
			);
			if (focusable.length === 0) return;

			const first = focusable[0];
			const last = focusable[focusable.length - 1];

			if (e.shiftKey && document.activeElement === first) {
				e.preventDefault();
				last.focus();
			} else if (!e.shiftKey && document.activeElement === last) {
				e.preventDefault();
				first.focus();
			}
		}

		document.addEventListener("keydown", handleKeyDown);
		// Focus the first focusable element on open
		const firstFocusable = panelRef.current.querySelector<HTMLElement>(
			"button, [href], input, textarea",
		);
		firstFocusable?.focus();

		return () => document.removeEventListener("keydown", handleKeyDown);
	}, [isOpen, close]);

	if (!isOpen) return null;

	return (
		<>
			{/* Backdrop on mobile */}
			<button
				type="button"
				className="fixed inset-0 bg-black/30 z-40 lg:hidden"
				onClick={close}
				onKeyDown={(e) => e.key === "Escape" && close()}
				tabIndex={-1}
				aria-label="Close chat"
			/>

			{/* Panel */}
			<aside
				ref={panelRef}
				role="dialog"
				aria-label="Chat"
				className="fixed right-0 top-14 h-[calc(100vh-56px)] w-full md:w-80 bg-surface-container-low border-l border-outline-variant/10 z-50 flex flex-col shadow-lg animate-in slide-in-from-right duration-200"
			>
				{/* Header */}
				<div className="flex items-center justify-between px-4 py-3 border-b border-outline-variant/10">
					<div className="flex items-center gap-2">
						{activeFriendId && (
							<button
								type="button"
								onClick={() => useChatStore.getState().backToList()}
								className="text-on-surface-variant hover:text-primary transition-colors"
							>
								<span className="material-symbols-outlined text-sm">arrow_back</span>
							</button>
						)}
						<span className="font-mono text-xs text-primary uppercase tracking-widest">
							{activeFriendId ? "Chat" : "Messages"}
						</span>
					</div>
					<button
						type="button"
						onClick={close}
						className="text-on-surface-variant hover:text-primary transition-colors"
					>
						<span className="material-symbols-outlined text-sm">close</span>
					</button>
				</div>

				{/* Content */}
				<div className="flex-1 overflow-hidden">
					{activeFriendId ? <ChatThread /> : <ChatConversationList />}
				</div>
			</aside>
		</>
	);
}
