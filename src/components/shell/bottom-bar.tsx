"use client";

import { Disc3, Search, User, Users } from "lucide-react";
import { usePathname } from "next/navigation";
import { BottomBarItem } from "@/components/shell/bottom-bar-item";

const TABS = [
	{ href: "/feed", label: "Feed", icon: Disc3 },
	{ href: "/perfil", label: "Perfil", icon: User },
	{ href: "/explorar", label: "Explorar", icon: Search },
	{ href: "/comunidade", label: "Comunidade", icon: Users },
] as const;

export function BottomBar() {
	const pathname = usePathname();

	return (
		<nav aria-label="Main navigation">
			<div
				className="fixed bottom-0 left-0 right-0 z-40 border-t border-border bg-[oklch(0.18_0.02_55/0.85)] backdrop-blur-[12px]"
				style={{ paddingBottom: "env(safe-area-inset-bottom, 0px)" }}
			>
				<div className="flex h-16">
					{TABS.map((tab) => (
						<BottomBarItem
							key={tab.href}
							href={tab.href}
							label={tab.label}
							icon={tab.icon}
							isActive={pathname.startsWith(tab.href)}
						/>
					))}
				</div>
			</div>
		</nav>
	);
}
