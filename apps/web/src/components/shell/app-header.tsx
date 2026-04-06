"use client";

import Link from "next/link";
import { NotificationBell } from "@/components/shell/notification-bell";
import { ChatToggleButton } from "@/components/chat/chat-toggle-button";
import { GlobalSearch } from "@/components/shell/global-search";

interface AppHeaderProps {
	displayName: string | null;
	avatarUrl: string | null;
	xp?: number;
	userId: string;
}

export function AppHeader({ xp = 0, userId }: AppHeaderProps) {
	return (
		<header className="fixed top-0 left-0 right-0 z-50 h-14 flex items-center px-4 md:px-6 w-full border-b border-outline-variant/20 bg-surface-dim">
			{/* Logo */}
			<Link href="/feed" className="shrink-0 mr-6">
				<span className="text-xl font-bold tracking-tighter font-heading">
					<span className="text-primary">DIG</span><span className="text-on-surface">SWAP</span>
				</span>
			</Link>

			{/* Nav links — hidden on mobile, compact gaps */}
			<nav className="hidden lg:flex items-center gap-5 mr-4">
				<NavLink href="/feed">Feed</NavLink>
				<NavLink href="/comunidade">Community</NavLink>
				<NavLink href="/explorar">Explore</NavLink>
				<NavLink href="/trades">Trades</NavLink>
				<NavLink href="/perfil">Profile</NavLink>
			</nav>

			{/* Search — takes remaining space */}
			<div className="flex-1 flex justify-end mr-3">
				<GlobalSearch />
			</div>

			{/* Action icons */}
			<div className="flex items-center gap-2">
				{xp > 0 && (
					<div className="hidden xl:flex items-center bg-surface-container-high px-3 py-1 rounded border border-outline-variant/20">
						<span className="font-mono text-xs text-primary uppercase tracking-wider">
							XP: {xp.toLocaleString()}
						</span>
					</div>
				)}
				<Link
					href="/como-usar"
					aria-label="How to use DigSwap"
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

function NavLink({ href, children }: { href: string; children: React.ReactNode }) {
	return (
		<Link
			href={href}
			className="font-mono text-xs uppercase tracking-[0.15em] text-on-surface-variant hover:text-on-surface transition-colors whitespace-nowrap"
		>
			{children}
		</Link>
	);
}
