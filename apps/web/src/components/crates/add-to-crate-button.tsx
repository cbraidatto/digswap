"use client";

import { AddToCratePopover } from "./add-to-crate-popover";

interface AddToCrateButtonProps {
  releaseId: string | null;
  discogsId: number | null;
  title: string | null;
  artist: string | null;
  coverImageUrl: string | null;
}

export function AddToCrateButton({
  releaseId,
  discogsId,
  title,
  artist,
  coverImageUrl,
}: AddToCrateButtonProps) {
  return (
    <AddToCratePopover
      releaseId={releaseId}
      discogsId={discogsId}
      title={title}
      artist={artist}
      coverImageUrl={coverImageUrl}
    >
      <button
        type="button"
        className="inline-flex items-center gap-1 font-mono text-xs text-on-surface-variant hover:text-primary transition-colors"
        title="Add to crate"
        aria-label="Add to crate"
      >
        <span className="material-symbols-outlined text-[12px]">folder_open</span>
        [ADD_TO_CRATE]
      </button>
    </AddToCratePopover>
  );
}
