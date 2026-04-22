"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { ChatToggleButton } from "@/components/chat/chat-toggle-button";
import { BarcodeScanner } from "@/components/shell/barcode-scanner";
import { GlobalSearch } from "@/components/shell/global-search";
import { NotificationBell } from "@/components/shell/notification-bell";

const NAV_ITEMS = [
	{ href: "/feed", label: "Feed", icon: "home" },
	{ href: "/explorar", label: "Explore", icon: "explore" },
	{ href: "/trades", label: "Trades", icon: "swap_horiz" },
	{ href: "/comunidade", label: "Community", icon: "group" },
	{ href: "/perfil", label: "Profile", icon: "person" },
] as const;

interface AppHeaderProps {
	displayName: string | null;
	avatarUrl: string | null;
	xp?: number;
	userId: string;
}

export function AppHeader({ userId, avatarUrl, displayName }: AppHeaderProps) {
	const pathname = usePathname();
	const [isDesktop, setIsDesktop] = useState(false);

	useEffect(() => {
		const shell = (window as unknown as { desktopShell?: { isDesktop?: () => boolean } })
			.desktopShell;
		if (shell?.isDesktop?.()) setIsDesktop(true);
	}, []);

	return (
		<header className="fixed top-0 left-0 right-0 z-50 h-14 flex items-center w-full border-b border-outline-variant/10 bg-surface-dim/95 backdrop-blur-md">
			<div className="flex items-center w-full px-4 md:px-6 gap-2">
				{/* ── Logo ── */}
				<Link href="/feed" className="shrink-0 mr-2 md:mr-4">
					<span className="text-lg md:text-xl font-bold tracking-tighter font-heading">
						<span className="text-primary">DIG</span>
						<span className="text-on-surface">SWAP</span>
					</span>
				</Link>

				{/* ── Nav links — pill style, hidden below lg ── */}
				<nav className="hidden lg:flex items-center bg-surface-container-high/50 rounded-full px-1 py-0.5 gap-0.5">
					{NAV_ITEMS.map((item) => {
						const isActive = pathname.startsWith(item.href);
						return (
							<Link
								key={item.href}
								href={item.href}
								className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full font-mono text-[11px] uppercase tracking-wider transition-all duration-200 ${
									isActive
										? "bg-primary/15 text-primary font-semibold"
										: "text-on-surface-variant hover:text-on-surface hover:bg-surface-container-high/80"
								}`}
							>
								<span
									className="material-symbols-outlined text-[16px]"
									style={isActive ? { fontVariationSettings: "'FILL' 1" } : undefined}
								>
									{item.icon}
								</span>
								<span className="hidden xl:inline">{item.label}</span>
							</Link>
						);
					})}
					{isDesktop && (
						<Link
							href="/biblioteca"
							className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full font-mono text-[11px] uppercase tracking-wider transition-all duration-200 ${
								pathname.startsWith("/biblioteca")
									? "bg-primary/15 text-primary font-semibold"
									: "text-on-surface-variant hover:text-on-surface hover:bg-surface-container-high/80"
							}`}
						>
							<span className="material-symbols-outlined text-[16px]">library_music</span>
							<span className="hidden xl:inline">Biblioteca</span>
						</Link>
					)}
				</nav>

				{/* ── Search — centered, takes available space ── */}
				<div className="flex-1 flex justify-center px-2 md:px-4">
					<GlobalSearch />
				</div>

				{/* ── Action icons ── */}
				<div className="flex items-center gap-1">
					<BarcodeScanner />
					<Link
						href="/como-usar"
						aria-label="How to use DigSwap"
						className="p-2 rounded-full text-on-surface-variant hover:text-primary hover:bg-surface-container-high/80 transition-colors"
					>
						<span className="material-symbols-outlined text-[20px]">help</span>
					</Link>
					<ChatToggleButton />
					<NotificationBell userId={userId} />
					<Link
						href="/perfil"
						aria-label="My profile"
						className="ml-1 w-8 h-8 rounded-full overflow-hidden border-2 border-outline-variant/30 hover:border-primary/60 transition-colors flex-shrink-0"
					>
						{avatarUrl ? (
							<Image
								src={avatarUrl}
								alt={displayName ?? "Profile"}
								width={32}
								height={32}
								unoptimized
								className="w-full h-full object-cover"
							/>
						) : (
							<div className="w-full h-full bg-surface-container-high flex items-center justify-center">
								<span className="material-symbols-outlined text-[16px] text-on-surface-variant">
									person
								</span>
							</div>
						)}
					</Link>
				</div>
			</div>
		</header>
	);
}
