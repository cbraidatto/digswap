"use client";

import { useChatStore } from "@/lib/chat/store";

export function ChatToggleButton() {
	const { toggle, isOpen } = useChatStore();

	return (
		<button
			type="button"
			onClick={toggle}
			aria-label={isOpen ? "Close chat" : "Open chat"}
			className={`relative p-2 rounded-full transition-colors ${
				isOpen
					? "text-primary bg-primary/15"
					: "text-on-surface-variant hover:text-primary hover:bg-surface-container-high/80"
			}`}
		>
			<span className="material-symbols-outlined text-[20px]">chat</span>
		</button>
	);
}
