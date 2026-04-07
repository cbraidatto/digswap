"use client";

import { useMemo, useState } from "react";
import { toast } from "sonner";
import { exportWantlistCsv } from "@/actions/export";
import type { WantlistItem } from "@/lib/wantlist/queries";
import { WantlistAddButton } from "./wantlist-add-button";
import { WantlistGrid } from "./wantlist-grid";

interface WantlistTabProps {
	items: WantlistItem[];
	total: number;
	pageSize: number;
	isOwner: boolean;
}

export function WantlistTab({ items, total, pageSize, isOwner }: WantlistTabProps) {
	const [search, setSearch] = useState("");
	const [sort, setSort] = useState<"date" | "alpha" | "rarity">("date");

	const filtered = useMemo(() => {
		let result = items;

		// Search filter (client-side)
		if (search.trim().length >= 2) {
			const q = search.toLowerCase();
			result = result.filter(
				(i) => i.title?.toLowerCase().includes(q) || i.artist?.toLowerCase().includes(q),
			);
		}

		// Sort
		if (sort === "alpha") {
			result = [...result].sort((a, b) => (a.title ?? "").localeCompare(b.title ?? ""));
		} else if (sort === "rarity") {
			result = [...result].sort((a, b) => (b.rarityScore ?? 0) - (a.rarityScore ?? 0));
		}
		// "date" = default order from server (desc createdAt)

		return result;
	}, [items, search, sort]);

	return (
		<div>
			<div className="flex items-center justify-between mb-4 flex-wrap gap-3">
				<h2 className="font-heading text-lg font-bold text-on-surface">Wantlist</h2>
				<div className="flex items-center gap-2">
					{isOwner && (
						<button
							type="button"
							onClick={async () => {
								const result = await exportWantlistCsv();
								if (result.error) {
									toast.error(result.error);
									return;
								}
								if (!result.csv) return;
								const blob = new Blob([result.csv], { type: "text/csv;charset=utf-8;" });
								const url = URL.createObjectURL(blob);
								const link = document.createElement("a");
								link.href = url;
								link.download = `digswap-wantlist-${new Date().toISOString().split("T")[0]}.csv`;
								link.click();
								URL.revokeObjectURL(url);
								toast.success("Wantlist exported");
							}}
							title="Export wantlist as CSV"
							className="p-2 rounded text-on-surface-variant hover:text-primary hover:bg-surface-container-high transition-colors"
						>
							<span className="material-symbols-outlined text-lg">download</span>
						</button>
					)}
					{isOwner && <WantlistAddButton />}
				</div>
			</div>

			{/* Search + sort */}
			<div className="flex items-center gap-2 mb-4 flex-wrap">
				<div className="flex items-center bg-surface-container-high/50 rounded-lg px-3 py-1.5 border border-outline-variant/10 focus-within:border-primary/40 transition-colors min-w-[180px]">
					<span className="material-symbols-outlined text-[16px] text-on-surface-variant/40 mr-2">
						search
					</span>
					<input
						type="text"
						value={search}
						onChange={(e) => setSearch(e.target.value)}
						placeholder="Search wantlist..."
						className="bg-transparent border-none outline-none font-mono text-xs text-on-surface placeholder:text-on-surface-variant/30 w-full"
					/>
				</div>
				<select
					value={sort}
					onChange={(e) => setSort(e.target.value as typeof sort)}
					className="bg-surface-container-high/50 border border-outline-variant/10 rounded-lg px-3 py-1.5 font-mono text-xs text-on-surface focus:outline-none focus:border-primary/40"
				>
					<option value="date">Recent</option>
					<option value="alpha">A-Z</option>
					<option value="rarity">Rarity</option>
				</select>
			</div>

			<WantlistGrid items={filtered} isOwner={isOwner} />

			{total > pageSize && (
				<p className="mt-4 text-center font-mono text-[10px] text-on-surface-variant/40">
					Showing {Math.min(pageSize, total)} of {total}
				</p>
			)}
		</div>
	);
}
