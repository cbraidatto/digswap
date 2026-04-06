"use client";

import Link from "next/link";
import { NotificationBell } from "@/components/shell/notification-bell";
import { ChatToggleButton } from "@/components/chat/chat-toggle-button";

interface AppHeaderProps {
	displayName: string | null;
	avatarUrl: string | null;
	xp?: number;
	userId: string;
}

export function AppHeader({ xp = 0, userId }: AppHeaderProps) {
	return (
		<header className="fixed top-0 left-0 right-0 z-50 h-14 flex items-center px-6 w-full border-b border-outline-variant/20 bg-surface-dim">
			<Link href="/feed" className="shrink-0">
				<span className="text-xl font-bold tracking-tighter font-heading">
					<span className="text-primary">DIG</span><span className="text-on-surface">SWAP</span>
				</span>
			</Link>

			<nav className="hidden md:flex absolute left-1/2 -translate-x-1/2 gap-8 items-center">
				<Link
					href="/feed"
					className="font-mono text-xs uppercase tracking-[0.2em] text-on-surface-variant hover:text-on-surface transition-colors"
				>
					Feed
				</Link>
				<Link
					href="/comunidade"
					className="font-mono text-xs uppercase tracking-[0.2em] text-on-surface-variant hover:text-on-surface transition-colors"
				>
					Community
				</Link>
				<Link
					href="/explorar"
					className="font-mono text-xs uppercase tracking-[0.2em] text-on-surface-variant hover:text-on-surface transition-colors"
				>
					Explore
				</Link>
				<Link
					href="/trades"
					className="font-mono text-xs uppercase tracking-[0.2em] text-on-surface-variant hover:text-on-surface transition-colors"
				>
					Trades
				</Link>
				<Link
					href="/perfil"
					className="font-mono text-xs uppercase tracking-[0.2em] text-on-surface-variant hover:text-on-surface transition-colors"
				>
					Profile
				</Link>
			</nav>

			<div className="flex items-center gap-4 ml-auto">
				{xp > 0 && (
					<div className="hidden sm:flex items-center bg-surface-container-high px-3 py-1 rounded border border-outline-variant/20">
						<span className="font-mono text-xs text-primary uppercase tracking-wider">
							XP: {xp.toLocaleString()}
						</span>
					</div>
				)}
				<Link
					href="/como-usar"
					aria-label="Como usar o DigSwap"
					className="p-2 rounded text-on-surface-variant hover:text-primary hover:bg-surface-container-high transition-colors"
				>
					<span className="material-symbols-outlined text-xl">help</span>
				</Link>
				<ChatToggleButton />
				<NotificationBell userId={userId} />
			</div>
		</header>
	);
}
