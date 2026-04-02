import type { ReactNode } from "react";
import type { CollectionItem } from "@/lib/collection/queries";
import { CollectionCard } from "./collection-card";

interface CollectionGridProps {
	items: CollectionItem[];
	isOwner: boolean;
	renderAction?: (item: CollectionItem) => ReactNode;
	/** When set, only renders items whose releaseId is in this array (client-side filter). */
	filterToIds?: string[];
}

export function CollectionGrid({ items, isOwner, renderAction, filterToIds }: CollectionGridProps) {
	const displayItems =
		filterToIds && filterToIds.length > 0
			? items.filter((item) => filterToIds.includes(item.releaseId))
			: items;

	if (displayItems.length === 0) {
		return (
			<div className="bg-surface-container-low rounded-xl p-12 flex flex-col items-center gap-4 text-center border border-outline-variant/10">
				<div className="w-16 h-16 bg-surface-container-high rounded-full flex items-center justify-center">
					<span className="material-symbols-outlined text-primary text-3xl">
						album
					</span>
				</div>
				<div>
					<div className="text-xs font-mono text-primary uppercase tracking-widest mb-2">
						EMPTY_REPOSITORY
					</div>
					<h3 className="text-lg font-bold font-heading text-on-surface mb-2">
						No records found
					</h3>
					<p className="text-sm text-on-surface-variant font-sans max-w-sm">
						Connect Discogs or add records manually to start building your
						collection.
					</p>
				</div>
			</div>
		);
	}

	return (
		<div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
			{displayItems.map((item) => (
				<CollectionCard
					key={item.id}
					item={item}
					isOwner={isOwner}
					actionSlot={renderAction?.(item)}
				/>
			))}
		</div>
	);
}
