"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import type { TradeableItem } from "@/lib/trades/proposal-queries";
import { ProposalItemCard } from "./ProposalItemCard";

interface CollectionColumnProps {
	title: string;
	items: TradeableItem[];
	selectedIds: string[];
	maxSelectable: number;
	onSelect: (item: TradeableItem) => void;
	side: "offer" | "want";
}

export function CollectionColumn({
	title,
	items,
	selectedIds,
	maxSelectable,
	onSelect,
	side,
}: CollectionColumnProps) {
	const [search, setSearch] = useState("");

	const filteredItems = useMemo(() => {
		if (!search.trim()) return items;
		const q = search.toLowerCase();
		return items.filter(
			(item) =>
				item.title.toLowerCase().includes(q) ||
				item.artist.toLowerCase().includes(q),
		);
	}, [items, search]);

	const atLimit = selectedIds.length >= maxSelectable;

	return (
		<div className="flex flex-col gap-3">
			{/* Header */}
			<div className="flex items-center justify-between">
				<h2 className="font-heading text-base font-bold text-foreground">
					{title}
				</h2>
				<span className="text-xs text-muted-foreground font-mono">
					{selectedIds.length} / {maxSelectable}
				</span>
			</div>

			{/* Search */}
			<div className="relative">
				<span className="material-symbols-outlined absolute left-2.5 top-1/2 -translate-y-1/2 text-base text-muted-foreground/50">
					search
				</span>
				<input
					type="text"
					value={search}
					onChange={(e) => setSearch(e.target.value)}
					placeholder="Search by title or artist..."
					className="w-full rounded border border-outline-variant bg-surface-container-lowest pl-8 pr-3 py-2 text-sm text-foreground placeholder:text-muted-foreground/40 focus:outline-none focus:border-primary transition-colors"
				/>
			</div>

			{/* Item grid */}
			{filteredItems.length === 0 ? (
				<div className="text-center py-10 border border-dashed border-outline-variant rounded">
					<span className="material-symbols-outlined text-3xl text-muted-foreground/30">
						album
					</span>
					<p className="text-muted-foreground text-sm mt-2">
						{items.length === 0
							? "No tradeable records"
							: "No results match your search"}
					</p>
					{items.length === 0 && (
						<p className="text-muted-foreground/50 text-xs mt-1">
							Set records as{" "}
							<Link href="/perfil" className="text-primary hover:underline">
								tradeable
							</Link>{" "}
							in your collection
						</p>
					)}
				</div>
			) : (
				<div className="grid grid-cols-1 lg:grid-cols-2 gap-2 max-h-[60vh] overflow-y-auto pr-1">
					{filteredItems.map((item) => {
						const isSelected = selectedIds.includes(item.id);
						const isDisabled = atLimit && !isSelected;

						return (
							<ProposalItemCard
								key={item.id}
								item={item}
								isSelected={isSelected}
								isDisabled={isDisabled}
								onSelect={() => onSelect(item)}
								side={side}
							/>
						);
					})}
				</div>
			)}
		</div>
	);
}
