"use client";

import { useState } from "react";
import { CreateCrateForm } from "./create-crate-form";

export function CrateEmptyState() {
  const [isCreating, setIsCreating] = useState(false);

  return (
    <div className="flex flex-col items-center justify-center py-16 gap-4">
      <div className="font-mono text-[10px] text-on-surface-variant tracking-[0.15em]">
        [NO_CRATES_YET]
      </div>
      <p className="font-mono text-sm text-on-surface-variant text-center max-w-xs">
        Create a crate to organize your next digging session.
      </p>
      {isCreating ? (
        <div className="w-full max-w-md">
          <CreateCrateForm
            onSuccess={() => setIsCreating(false)}
            onCancel={() => setIsCreating(false)}
          />
        </div>
      ) : (
        <button
          onClick={() => setIsCreating(true)}
          className="font-mono text-[10px] px-3 py-1.5 rounded border border-primary/40 text-primary hover:bg-primary/10 transition-colors"
        >
          [+ NEW_CRATE]
        </button>
      )}
    </div>
  );
}
