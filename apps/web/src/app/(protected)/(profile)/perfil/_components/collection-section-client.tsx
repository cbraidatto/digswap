"use client";

import { useState } from "react";
import type { CollectionItem } from "@/lib/collection/queries";
import { CollectionViewToggle, type ViewMode } from "./collection-view-toggle";
import { CollectionGridWithCrates } from "./collection-grid-with-crates";

interface CollectionSectionClientProps {
  items: CollectionItem[];
}

/**
 * Client shell that owns viewMode state for the collection section.
 * Wraps the view toggle and the grid so the server page stays clean.
 */
export function CollectionSectionClient({ items }: CollectionSectionClientProps) {
  const [viewMode, setViewMode] = useState<ViewMode>("list");

  return (
    <>
      <CollectionViewToggle onChange={setViewMode} />
      <div className="mt-4">
        <CollectionGridWithCrates items={items} viewMode={viewMode} />
      </div>
    </>
  );
}
