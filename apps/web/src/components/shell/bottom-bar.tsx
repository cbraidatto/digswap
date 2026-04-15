"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";

const TABS = [
	{ href: "/radar", label: "Radar", icon: "track_changes" },
	{ href: "/explorar", label: "Explore", icon: "explore" },
	{ href: "/trades", label: "Trades", icon: "swap_horiz" },
	{ href: "/perfil", label: "Profile", icon: "person" },
] as const;

interface BottomBarProps {
	avatarUrl?: string | null;
}

export function BottomBar({ avatarUrl }: BottomBarProps) {
	const pathname = usePathname();

	return (
		<nav
			aria-label="Main navigation"
			className="fixed bottom-0 left-0 right-0 bg-surface-container-low h-16 flex items-center justify-around md:hidden border-t border-outline-variant/10 px-4 z-40"
			style={{ paddingBottom: "env(safe-area-inset-bottom, 0px)" }}
		>
			{TABS.map((tab) => {
				const isActive = pathname.startsWith(tab.href);
				const isProfile = tab.href === "/perfil";

				return (
					<Link
						key={tab.href}
						href={tab.href}
						aria-current={isActive ? "page" : undefined}
						className={`flex flex-col items-center gap-1 transition-colors ${
							isActive ? "text-primary" : "text-on-surface-variant"
						}`}
					>
						{isProfile && avatarUrl ? (
							<div
								className={`w-6 h-6 rounded-full overflow-hidden border-2 transition-colors ${
									isActive ? "border-primary" : "border-on-surface-variant/40"
								}`}
							>
								<Image
									src={avatarUrl}
									alt="Profile"
									width={24}
									height={24}
									unoptimized
									className="w-full h-full object-cover"
								/>
							</div>
						) : (
							<span
								className="material-symbols-outlined"
								style={isActive ? { fontVariationSettings: "'FILL' 1" } : undefined}
							>
								{tab.icon}
							</span>
						)}
						<span className="text-xs font-mono uppercase">{tab.label}</span>
					</Link>
				);
			})}
		</nav>
	);
}
