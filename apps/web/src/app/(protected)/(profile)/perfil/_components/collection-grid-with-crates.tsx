"use client";

import type { CollectionItem } from "@/lib/collection/queries";
import { CollectionGrid } from "./collection-grid";
import { AddToCrateButton } from "@/components/crates/add-to-crate-button";

interface CollectionGridWithCratesProps {
  items: CollectionItem[];
}

/**
 * Client wrapper around CollectionGrid that injects the [ADD_TO_CRATE] action
 * into every card via renderAction. Only used on the own /perfil page (isOwner=true).
 */
export function CollectionGridWithCrates({ items }: CollectionGridWithCratesProps) {
  return (
    <CollectionGrid
      items={items}
      isOwner={true}
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
