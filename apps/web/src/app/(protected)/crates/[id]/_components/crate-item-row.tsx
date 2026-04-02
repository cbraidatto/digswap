"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import type { CrateItemRow as CrateItemRowType } from "@/lib/crates/types";
import { moveToWantlist, moveToCollection } from "@/actions/crates";

interface CrateItemRowProps {
  item: CrateItemRowType;
}

export function CrateItemRow({ item }: CrateItemRowProps) {
  const router = useRouter();
  const [isMoving, setIsMoving] = useState(false);

  const handleMoveToWantlist = async () => {
    setIsMoving(true);
    try {
      const result = await moveToWantlist(item.id);
      if (result.success) {
        toast.success("Moved to wantlist");
        router.refresh();
      } else {
        toast.error(result.error ?? "Failed to move to wantlist");
      }
    } finally {
      setIsMoving(false);
    }
  };

  const handleMoveToCollection = async () => {
    setIsMoving(true);
    try {
      const result = await moveToCollection(item.id);
      if (result.success) {
        toast.success("Moved to collection");
        router.refresh();
      } else {
        toast.error(result.error ?? "Failed to move to collection");
      }
    } finally {
      setIsMoving(false);
    }
  };

  return (
    <div
      className={`flex items-center gap-3 py-2 border-b border-outline-variant/10 last:border-b-0 ${
        item.status === "found" ? "opacity-50" : ""
      }`}
    >
      {/* Cover image */}
      <div className="w-10 h-10 flex-shrink-0 rounded overflow-hidden bg-surface-container-high flex items-center justify-center">
        {item.coverImageUrl ? (
          <img
            src={item.coverImageUrl}
            alt={item.title ?? "Record cover"}
            className="w-full h-full object-cover"
          />
        ) : (
          <span className="material-symbols-outlined text-base text-on-surface-variant">
            album
          </span>
        )}
      </div>

      {/* Title + artist */}
      <div className="flex-1 min-w-0">
        <p className="font-heading text-sm font-semibold text-on-surface truncate">
          {item.title ?? "Unknown"}
        </p>
        {item.artist && (
          <p className="font-mono text-xs text-on-surface-variant truncate">
            {item.artist}
          </p>
        )}
      </div>

      {/* Status / actions */}
      <div className="flex-shrink-0 flex items-center gap-2">
        {item.status === "found" ? (
          <span className="font-mono text-xs px-1.5 py-0.5 rounded border text-tertiary border-tertiary/30">
            [FOUND]
          </span>
        ) : (
          <>
            <button
              onClick={handleMoveToWantlist}
              disabled={isMoving}
              className="font-mono text-xs px-2 py-1 rounded border border-outline-variant/20 text-on-surface-variant hover:bg-surface-container-high transition-colors disabled:opacity-50"
            >
              [→ WANTLIST]
            </button>
            <button
              onClick={handleMoveToCollection}
              disabled={isMoving}
              className="font-mono text-xs px-2 py-1 rounded border border-outline-variant/20 text-on-surface-variant hover:bg-surface-container-high transition-colors disabled:opacity-50"
            >
              [→ COLLECTION]
            </button>
          </>
        )}
      </div>
    </div>
  );
}
