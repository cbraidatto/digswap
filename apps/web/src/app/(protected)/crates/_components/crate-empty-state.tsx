"use client";

import { useState } from "react";
import { CreateCrateForm } from "./create-crate-form";

export function CrateEmptyState() {
  const [isCreating, setIsCreating] = useState(false);

  return (
    <div className="flex flex-col items-center justify-center py-16 gap-4">
      <span className="material-symbols-outlined text-4xl text-primary/40">
        inventory_2
      </span>
      <h3 className="font-heading text-base font-semibold text-on-surface">
        No crates yet
      </h3>
      <p className="text-sm text-on-surface-variant text-center max-w-xs">
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
          type="button"
          className="text-sm px-4 py-2 rounded-lg border border-primary/40 text-primary hover:bg-primary/10 transition-colors font-medium"
        >
          Create a crate
        </button>
      )}
    </div>
  );
}
