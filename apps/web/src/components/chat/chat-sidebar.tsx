"use client";

import { useChatStore } from "@/lib/chat/store";
import { ChatConversationList } from "./chat-conversation-list";
import { ChatThread } from "./chat-thread";

export function ChatSidebar() {
	const { isOpen, close, activeFriendId } = useChatStore();

	if (!isOpen) return null;

	return (
		<>
			{/* Backdrop on mobile */}
			<div
				className="fixed inset-0 bg-black/30 z-40 lg:hidden"
				onClick={close}
				onKeyDown={(e) => e.key === "Escape" && close()}
				role="button"
				tabIndex={-1}
				aria-label="Close chat"
			/>

			{/* Panel */}
			<aside
				className="fixed right-0 top-14 h-[calc(100vh-56px)] w-80 bg-surface-container-low border-l border-outline-variant/10 z-50 flex flex-col shadow-lg animate-in slide-in-from-right duration-200"
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
