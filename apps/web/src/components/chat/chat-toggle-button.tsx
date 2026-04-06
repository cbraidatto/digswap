"use client";

import { useChatStore } from "@/lib/chat/store";

export function ChatToggleButton() {
	const { toggle, isOpen } = useChatStore();

	return (
		<button
			type="button"
			onClick={toggle}
			aria-label={isOpen ? "Close chat" : "Open chat"}
			className={`relative p-2 rounded transition-colors ${
				isOpen
					? "text-primary bg-primary/10"
					: "text-on-surface-variant hover:text-primary hover:bg-surface-container-high"
			}`}
		>
			<span className="material-symbols-outlined text-xl">chat</span>
		</button>
	);
}
