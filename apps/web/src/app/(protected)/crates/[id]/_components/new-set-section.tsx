"use client";

import { useState } from "react";
import type { CrateItemRow } from "@/lib/crates/types";
import { SetBuilderPanel } from "./set-builder-panel";

interface NewSetSectionProps {
  crateId: string;
  items: CrateItemRow[];
}

export function NewSetSection({ crateId, items }: NewSetSectionProps) {
  const [isOpen, setIsOpen] = useState(false);

  if (isOpen) {
    return (
      <SetBuilderPanel
        crateId={crateId}
        items={items}
        onClose={() => setIsOpen(false)}
      />
    );
  }

  return (
    <button
      type="button"
      onClick={() => setIsOpen(true)}
      className="font-mono text-xs px-3 py-1.5 rounded border border-outline-variant/20 text-on-surface-variant hover:bg-surface-container-high transition-colors"
    >
      [+ NEW_SET]
    </button>
  );
}
