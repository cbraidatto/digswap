"use client";

import { useState, useEffect, useCallback } from "react";
import { useSearchParams } from "next/navigation";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import type { TradeInboxRow } from "@/lib/trades/queries";
import { TradeRowList } from "./trade-row";

type TabKey = "pending" | "active" | "completed";

interface TradeInboxProps {
	initialTrades: TradeInboxRow[];
	initialTab: TabKey;
	tabCounts: {
		pending: number;
		active: number;
		completed: number;
	};
}

const TAB_CONFIG: { key: TabKey; label: string }[] = [
	{ key: "pending", label: "PENDING" },
	{ key: "active", label: "ACTIVE" },
	{ key: "completed", label: "COMPLETED" },
];

const EMPTY_STATES: Record<TabKey, string> = {
	pending:
		"No pending trade requests. Request audio from a digger's collection to get started.",
	active:
		"No active transfers. Accept a pending request to start a live session.",
	completed:
		"No completed trades yet. Your trade history will appear here.",
};

export function TradeInbox({
	initialTrades,
	initialTab,
	tabCounts,
}: TradeInboxProps) {
	const searchParams = useSearchParams();
	const paramTab = searchParams.get("tab") as TabKey | null;
	const defaultTab =
		paramTab && ["pending", "active", "completed"].includes(paramTab)
			? paramTab
			: initialTab;

	const [activeTab, setActiveTab] = useState<TabKey>(defaultTab);
	const [trades, setTrades] = useState<TradeInboxRow[]>(initialTrades);
	const [loading, setLoading] = useState(false);
	const [counts] = useState(tabCounts);

	// Fetch trades for a given tab via API route
	const fetchTrades = useCallback(async (tab: TabKey) => {
		setLoading(true);
		try {
			const res = await fetch(`/api/trades?tab=${tab}`);
			if (res.ok) {
				const data = await res.json();
				setTrades(data.trades ?? []);
			}
		} catch {
			// Keep existing trades on error
		} finally {
			setLoading(false);
		}
	}, []);

	// Update URL when tab changes (same pattern as Phase 8 explorar tabs)
	useEffect(() => {
		const url =
			activeTab === "pending"
				? "/trades"
				: `/trades?tab=${activeTab}`;
		window.history.replaceState(null, "", url);
	}, [activeTab]);

	function handleTabChange(value: string | number | null) {
		const tab = value as TabKey;
		if (!tab) return;
		setActiveTab(tab);
		// Use initial data for the initial tab, fetch for others
		if (tab !== initialTab) {
			fetchTrades(tab);
		} else {
			setTrades(initialTrades);
		}
	}

	const hasTrades =
		counts.pending > 0 || counts.active > 0 || counts.completed > 0;

	// Global empty state when no trades at all
	if (!hasTrades) {
		return (
			<div className="flex flex-col items-center justify-center py-16 px-4">
				<span className="material-symbols-outlined text-on-surface-variant/40 text-5xl mb-4">
					swap_horiz
				</span>
				<h3 className="text-[10px] font-mono text-on-surface-variant uppercase tracking-[0.2em] mb-2">
					NO_TRADES_YET
				</h3>
				<p className="text-sm text-on-surface-variant font-sans text-center max-w-md">
					Start by requesting audio from another digger&apos;s collection.
					Browse records on Explorar or visit a digger&apos;s profile to
					initiate a trade.
				</p>
			</div>
		);
	}

	function renderTabContent(tab: TabKey) {
		if (loading && activeTab === tab) {
			return (
				<div className="space-y-2">
					{[1, 2, 3].map((i) => (
						<Skeleton key={i} className="h-14 rounded-lg w-full" />
					))}
				</div>
			);
		}

		if (activeTab === tab && trades.length > 0) {
			return <TradeRowList trades={trades} />;
		}

		return (
			<div className="text-center py-12">
				<p className="text-sm text-on-surface-variant font-sans">
					{EMPTY_STATES[tab]}
				</p>
			</div>
		);
	}

	return (
		<Tabs
			defaultValue={defaultTab}
			value={activeTab}
			onValueChange={handleTabChange}
		>
			<TabsList
				variant="line"
				className="w-full justify-start gap-6 border-b border-outline-variant/10 mb-6 bg-transparent"
			>
				{TAB_CONFIG.map(({ key, label }) => (
					<TabsTrigger
						key={key}
						value={key}
						className="font-mono text-[10px] uppercase tracking-widest data-active:text-primary data-active:after:bg-primary"
					>
						{label}
						{counts[key] > 0 && (
							<span className="opacity-60 ml-1">({counts[key]})</span>
						)}
					</TabsTrigger>
				))}
			</TabsList>

			{TAB_CONFIG.map(({ key }) => (
				<TabsContent key={key} value={key}>
					{renderTabContent(key)}
				</TabsContent>
			))}
		</Tabs>
	);
}
