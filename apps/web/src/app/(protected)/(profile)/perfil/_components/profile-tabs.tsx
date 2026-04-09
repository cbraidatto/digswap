"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

const TABS = [
	{ key: "collection", label: "Collection", icon: "album" },
	{ key: "wantlist", label: "Wantlist", icon: "favorite" },
	{ key: "trading", label: "Trading", icon: "swap_horiz" },
	{ key: "about", label: "About", icon: "info" },
] as const;

export type ProfileTab = (typeof TABS)[number]["key"];

interface ProfileTabsProps {
	activeTab: ProfileTab;
	collectionCount: number;
	wantlistCount: number;
	tradeCount: number;
	children: Record<ProfileTab, React.ReactNode>;
	/** Action buttons rendered on the right side of the tab bar */
	actionButtons?: React.ReactNode;
	/** Base path for URL updates (defaults to /perfil) */
	basePath?: string;
}

export function ProfileTabs({
	activeTab: initialTab,
	collectionCount,
	wantlistCount,
	tradeCount,
	children,
	actionButtons,
	basePath = "/perfil",
}: ProfileTabsProps) {
	const [activeTab, setActiveTab] = useState<ProfileTab>(initialTab);
	const router = useRouter();

	function switchTab(tab: ProfileTab) {
		setActiveTab(tab);
		const url = tab === "collection" ? basePath : `${basePath}?tab=${tab}`;
		router.replace(url, { scroll: false });
	}

	const counts: Record<string, number | undefined> = {
		collection: collectionCount,
		wantlist: wantlistCount,
		trading: tradeCount,
	};

	return (
		<div>
			{/* Tab bar */}
			<div
				role="tablist"
				aria-label="Profile sections"
				className="flex items-center border-b border-outline-variant/10 mb-6"
			>
				<div className="flex items-center gap-1 flex-1">
					{TABS.map((tab) => {
						const isActive = activeTab === tab.key;
						const count = counts[tab.key];
						return (
							<button
								key={tab.key}
								type="button"
								role="tab"
								aria-selected={isActive}
								onClick={() => switchTab(tab.key)}
								className={`flex items-center gap-1.5 px-4 py-3 font-mono text-xs uppercase tracking-wider transition-all duration-200 border-b-2 -mb-px ${
									isActive
										? "border-primary text-primary font-semibold"
										: "border-transparent text-on-surface-variant hover:text-on-surface hover:border-outline-variant/30"
								}`}
							>
								<span
									className="material-symbols-outlined text-[16px]"
									style={isActive ? { fontVariationSettings: "'FILL' 1" } : undefined}
								>
									{tab.icon}
								</span>
								{tab.label}
								{count !== undefined && (
									<span
										className={`text-[10px] ml-0.5 ${isActive ? "text-primary/70" : "text-on-surface-variant/40"}`}
									>
										{count}
									</span>
								)}
							</button>
						);
					})}
				</div>
				{actionButtons && <div className="flex items-center gap-2 pb-1">{actionButtons}</div>}
			</div>

			{/* Tab content with fade transition */}
			<div role="tabpanel" key={activeTab} className="animate-in fade-in duration-200">
				{children[activeTab]}
			</div>
		</div>
	);
}
