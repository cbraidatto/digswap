"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const LEFT_TABS = [
	{ href: "/feed", label: "Feed", icon: "home" },
	{ href: "/explorar", label: "Explore", icon: "explore" },
] as const;

const RIGHT_TABS = [
	{ href: "/comunidade", label: "Orgs", icon: "group" },
	{ href: "/perfil", label: "Root", icon: "person" },
] as const;

export function BottomBar() {
	const pathname = usePathname();

	return (
		<nav
			aria-label="Main navigation"
			className="fixed bottom-0 left-0 right-0 bg-surface-container-low h-16 flex items-center justify-around lg:hidden border-t border-outline-variant/10 px-4 z-40"
			style={{ paddingBottom: "env(safe-area-inset-bottom, 0px)" }}
		>
			{LEFT_TABS.map((tab) => {
				const isActive = pathname.startsWith(tab.href);
				return (
					<Link
						key={tab.href}
						href={tab.href}
						aria-current={isActive ? "page" : undefined}
						className={`flex flex-col items-center gap-1 transition-colors ${
							isActive ? "text-primary" : "text-on-surface-variant"
						}`}
					>
						<span
							className="material-symbols-outlined"
							style={isActive ? { fontVariationSettings: "'FILL' 1" } : undefined}
						>
							{tab.icon}
						</span>
						<span className="text-[10px] font-mono uppercase">{tab.label}</span>
					</Link>
				);
			})}

			{/* Center FAB */}
			<Link
				href="/trades/new"
				className="bg-primary text-on-primary w-12 h-12 rounded-full flex items-center justify-center -translate-y-4 shadow-lg shadow-primary/20 transition-transform hover:scale-105"
				aria-label="New trade"
			>
				<span className="material-symbols-outlined">add</span>
			</Link>

			{RIGHT_TABS.map((tab) => {
				const isActive = pathname.startsWith(tab.href);
				return (
					<Link
						key={tab.href}
						href={tab.href}
						aria-current={isActive ? "page" : undefined}
						className={`flex flex-col items-center gap-1 transition-colors ${
							isActive ? "text-primary" : "text-on-surface-variant"
						}`}
					>
						<span
							className="material-symbols-outlined"
							style={isActive ? { fontVariationSettings: "'FILL' 1" } : undefined}
						>
							{tab.icon}
						</span>
						<span className="text-[10px] font-mono uppercase">{tab.label}</span>
					</Link>
				);
			})}
		</nav>
	);
}
