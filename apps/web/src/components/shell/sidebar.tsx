"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { PremiumBadge } from "@/components/ui/PremiumBadge";

const NAV_ITEMS = [
	{ href: "/feed", label: "Feed", icon: "history" },
	{ href: "/trades", label: "Trades", icon: "swap_horiz" },
	{ href: "/comunidade", label: "Community", icon: "group" },
	{ href: "/perfil", label: "Collection", icon: "database" },
] as const;

interface SidebarProps {
	displayName: string | null;
	rank?: string;
	subscriptionTier?: string;
}

export function Sidebar({ displayName, rank = "Digger", subscriptionTier }: SidebarProps) {
	const pathname = usePathname();

	return (
		<aside className="fixed left-0 top-14 h-[calc(100vh-56px)] w-64 bg-surface-container-low flex-col hidden lg:flex z-40 border-r border-outline-variant/10">
			<div className="p-6 border-b border-outline-variant/10">
				<div className="flex items-center gap-3 mb-4">
					<div className="w-10 h-10 bg-surface-container-high rounded flex items-center justify-center border border-primary/20">
						<span className="material-symbols-outlined text-primary">terminal</span>
					</div>
					<div>
						<div className="text-primary font-mono text-sm font-bold">
							{displayName ?? "DIGGER"}
						</div>
						<div className="flex items-center gap-1.5">
							<span className="text-on-surface-variant text-[10px] font-mono uppercase tracking-widest">
								{rank}
							</span>
							{(subscriptionTier === "premium_monthly" || subscriptionTier === "premium_annual") && (
								<PremiumBadge />
							)}
						</div>
					</div>
				</div>
				<Link
					href="/perfil"
					className="w-full bg-primary-container text-on-primary-container font-mono font-bold py-2 rounded text-xs hover:brightness-110 transition-all flex items-center justify-center gap-2"
				>
					<span className="material-symbols-outlined text-sm">add</span>
					NEW_COLLECTION
				</Link>
			</div>

			<nav className="flex-1 overflow-y-auto py-4">
				<div className="px-4 mb-4">
					<span className="text-[10px] font-mono text-outline uppercase tracking-widest px-2">
						Navigation
					</span>
					<div className="mt-2 space-y-1">
						{NAV_ITEMS.map((item) => {
							const isActive = pathname.startsWith(item.href);
							return (
								<Link
									key={item.href}
									href={item.href}
									className={`p-3 flex items-center gap-3 transition-all duration-200 ${
										isActive
											? "bg-surface-container-high text-primary border-l-4 border-primary"
											: "text-on-surface-variant hover:bg-surface-bright hover:text-on-surface"
									}`}
								>
									<span className="material-symbols-outlined">{item.icon}</span>
									<span className="font-mono text-sm">{item.label}</span>
								</Link>
							);
						})}
					</div>
				</div>

			</nav>

			<div className="p-4 border-t border-outline-variant/10 flex gap-4">
				<Link
					href="/settings"
					className="text-on-surface-variant hover:text-primary transition-colors flex items-center gap-2 text-xs font-mono"
				>
					<span className="material-symbols-outlined text-sm">settings</span>
					Settings
				</Link>
			</div>
		</aside>
	);
}
