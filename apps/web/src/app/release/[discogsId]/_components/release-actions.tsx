"use client";

import { AddToCrateButton } from "@/components/crates/add-to-crate-button";

interface ReleaseActionsProps {
  releaseId: string;
  discogsId: number | null;
  title: string;
  artist: string;
  coverImageUrl: string | null;
}

export function ReleaseActions({
  releaseId,
  discogsId,
  title,
  artist,
  coverImageUrl,
}: ReleaseActionsProps) {
  return (
    <div className="flex items-center gap-3">
      <AddToCrateButton
        releaseId={releaseId}
        discogsId={discogsId}
        title={title}
        artist={artist}
        coverImageUrl={coverImageUrl}
      />
    </div>
  );
}
