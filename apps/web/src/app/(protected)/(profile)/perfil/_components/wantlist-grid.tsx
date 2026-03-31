import type { WantlistItem } from "@/lib/wantlist/queries";
import { WantlistCard } from "./wantlist-card";

interface WantlistGridProps {
	items: WantlistItem[];
	isOwner: boolean;
}

export function WantlistGrid({ items, isOwner }: WantlistGridProps) {
	if (items.length === 0) {
		return (
			<div className="bg-surface-container-low rounded-xl p-12 flex flex-col items-center gap-4 text-center border border-outline-variant/10">
				<div className="w-16 h-16 bg-surface-container-high rounded-full flex items-center justify-center">
					<span className="material-symbols-outlined text-secondary text-3xl">
						manage_search
					</span>
				</div>
				<div>
					<div className="text-[10px] font-mono text-secondary uppercase tracking-widest mb-2">
						EMPTY_WANTLIST
					</div>
					<h3 className="text-lg font-bold font-heading text-on-surface mb-2">
						Nothing on the radar yet
					</h3>
					<p className="text-sm text-on-surface-variant font-sans max-w-sm">
						Add records you&apos;re hunting to keep track of your search.
					</p>
				</div>
			</div>
		);
	}

	return (
		<div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
			{items.map((item) => (
				<WantlistCard key={item.id} item={item} isOwner={isOwner} />
			))}
		</div>
	);
}
