"use client";

import { useState, useEffect } from "react";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { getUserCratesAction, addToCrate, createCrate } from "@/actions/crates";
import { toast } from "sonner";
import type { CrateRow } from "@/lib/crates/types";

interface AddToCratePopoverProps {
  releaseId: string | null;
  discogsId: number | null;
  title: string | null;
  artist: string | null;
  coverImageUrl: string | null;
  children: React.ReactNode;
}

export function AddToCratePopover({
  releaseId,
  discogsId,
  title,
  artist,
  coverImageUrl,
  children,
}: AddToCratePopoverProps) {
  const [open, setOpen] = useState(false);
  const [crates, setCrates] = useState<(CrateRow & { itemCount: number })[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isAdding, setIsAdding] = useState<string | null>(null);
  const [showInlineCreate, setShowInlineCreate] = useState(false);
  const [newCrateName, setNewCrateName] = useState("");

  useEffect(() => {
    if (!open) return;
    setIsLoading(true);
    getUserCratesAction()
      .then((result) => {
        const data = result.data ?? [];
        setCrates(data);
        if (data.length === 0) {
          setShowInlineCreate(true);
        }
      })
      .catch(() => {
        setCrates([]);
        setShowInlineCreate(true);
      })
      .finally(() => setIsLoading(false));
  }, [open]);

  const handleAddToCrate = async (crateId: string, crateName: string) => {
    setIsAdding(crateId);
    try {
      const result = await addToCrate({
        crateId,
        releaseId,
        discogsId,
        title,
        artist,
        coverImageUrl,
      });
      if (result.success) {
        toast.success(`Added to ${crateName}`);
        setOpen(false);
      } else {
        toast.error(result.error ?? "Failed to add to crate");
      }
    } catch {
      toast.error("Failed to add to crate");
    } finally {
      setIsAdding(null);
    }
  };

  const handleCreateAndAdd = async () => {
    if (!newCrateName.trim()) return;
    setIsAdding("creating");
    try {
      const today = new Date().toISOString().split("T")[0];
      const createResult = await createCrate({
        name: newCrateName.trim(),
        date: today,
        sessionType: "digging_trip",
      });
      if (!createResult.success || !createResult.data?.crateId) {
        toast.error(createResult.error ?? "Failed to create crate");
        setIsAdding(null);
        return;
      }
      const crateId = createResult.data.crateId;
      const addResult = await addToCrate({
        crateId,
        releaseId,
        discogsId,
        title,
        artist,
        coverImageUrl,
      });
      if (addResult.success) {
        toast.success(`Created and added to ${newCrateName.trim()}`);
        setOpen(false);
        setNewCrateName("");
      } else {
        toast.error(addResult.error ?? "Failed to add item to new crate");
      }
    } catch {
      toast.error("Failed to create and add to crate");
    } finally {
      setIsAdding(null);
    }
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger render={<span className="inline-flex" />}>
        {children}
      </PopoverTrigger>
      <PopoverContent className="w-72 p-4 bg-surface-container border-outline-variant/20">
        <div>
          <p className="font-mono text-[10px] text-primary tracking-[0.15em] mb-3">
            [ADD_TO_CRATE]
          </p>

          {isLoading && (
            <div className="flex items-center gap-2 py-2">
              <span className="w-3 h-3 border border-primary border-t-transparent rounded-full animate-spin" />
              <span className="font-mono text-[10px] text-on-surface-variant">
                Loading crates...
              </span>
            </div>
          )}

          {!isLoading && crates.length > 0 && !showInlineCreate && (
            <div className="space-y-0.5">
              {crates.map((crate) => (
                <button
                  key={crate.id}
                  type="button"
                  onClick={() => handleAddToCrate(crate.id, crate.name)}
                  disabled={isAdding !== null}
                  className="w-full flex items-center justify-between py-2 px-2 rounded hover:bg-surface-container-high transition-colors disabled:opacity-50"
                >
                  <span className="font-mono text-[11px] text-on-surface truncate">
                    {crate.name}
                  </span>
                  <span className="flex items-center gap-1.5 flex-shrink-0">
                    {isAdding === crate.id && (
                      <span className="w-3 h-3 border border-primary border-t-transparent rounded-full animate-spin" />
                    )}
                    <span className="font-mono text-[10px] text-on-surface-variant">
                      {crate.itemCount}
                    </span>
                  </span>
                </button>
              ))}
            </div>
          )}

          {!isLoading && crates.length === 0 && !showInlineCreate && (
            <p className="font-mono text-[10px] text-on-surface-variant/70 py-2">
              No crates yet. Create one below.
            </p>
          )}

          {showInlineCreate && (
            <div className="space-y-2 mt-1">
              <input
                type="text"
                value={newCrateName}
                onChange={(e) => setNewCrateName(e.target.value)}
                placeholder="Crate name..."
                className="font-mono text-[11px] bg-surface-container-low border border-outline-variant/20 rounded h-8 w-full px-2 focus:outline-none focus:border-primary/40 text-on-surface"
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleCreateAndAdd();
                }}
              />
              <button
                type="button"
                onClick={handleCreateAndAdd}
                disabled={!newCrateName.trim() || isAdding !== null}
                className="font-mono text-[10px] bg-primary-container text-on-primary-container h-7 w-full rounded disabled:opacity-50 transition-opacity"
              >
                {isAdding === "creating" ? (
                  <span className="flex items-center justify-center gap-1.5">
                    <span className="w-3 h-3 border border-on-primary-container border-t-transparent rounded-full animate-spin" />
                    Creating...
                  </span>
                ) : (
                  "[CREATE + ADD]"
                )}
              </button>
              {crates.length > 0 && (
                <button
                  type="button"
                  onClick={() => setShowInlineCreate(false)}
                  className="w-full font-mono text-[10px] text-on-surface-variant hover:text-on-surface transition-colors text-center"
                >
                  [CANCEL]
                </button>
              )}
            </div>
          )}

          {!isLoading && crates.length > 0 && !showInlineCreate && (
            <button
              type="button"
              onClick={() => setShowInlineCreate(true)}
              className="w-full font-mono text-[10px] text-primary hover:underline mt-2 text-left"
            >
              [ + New crate ]
            </button>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
