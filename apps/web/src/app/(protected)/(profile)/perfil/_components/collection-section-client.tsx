"use client";

import { useState } from "react";
import type { CollectionItem } from "@/lib/collection/queries";
import { CollectionGrid } from "./collection-grid";
import { CollectionViewToggle, type ViewMode } from "./collection-view-toggle";

interface CollectionSectionClientProps {
	items: CollectionItem[];
}

/**
 * Client shell that owns viewMode state for the collection section.
 */
export function CollectionSectionClient({ items }: CollectionSectionClientProps) {
	const [viewMode, setViewMode] = useState<ViewMode>("list");

	return (
		<>
			<CollectionViewToggle onChange={setViewMode} />
			<div className="mt-4">
				<CollectionGrid items={items} isOwner={true} viewMode={viewMode} />
			</div>
		</>
	);
}
