"use client";

import { AddToCrateButton } from "@/components/crates/add-to-crate-button";
import type { CollectionItem } from "@/lib/collection/queries";
import { CollectionGrid, type ViewMode } from "./collection-grid";

interface CollectionGridWithCratesProps {
	items: CollectionItem[];
	viewMode?: ViewMode;
}

/**
 * Client wrapper around CollectionGrid that injects the [ADD_TO_CRATE] action
 * into every card via renderAction. Only used on the own /perfil page (isOwner=true).
 */
export function CollectionGridWithCrates({
	items,
	viewMode = "list",
}: CollectionGridWithCratesProps) {
	return (
		<CollectionGrid
			items={items}
			isOwner={true}
			viewMode={viewMode}
			renderAction={(item) => (
				<AddToCrateButton
					releaseId={item.releaseId ?? null}
					discogsId={item.discogsId ?? null}
					title={item.title ?? null}
					artist={item.artist ?? null}
					coverImageUrl={item.coverImageUrl ?? null}
				/>
			)}
		/>
	);
}
