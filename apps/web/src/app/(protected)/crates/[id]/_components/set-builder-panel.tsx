"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { GripVertical, X } from "lucide-react";
import {
  DndContext,
  closestCenter,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  verticalListSortingStrategy,
  useSortable,
  arrayMove,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import type { CrateItemRow } from "@/lib/crates/types";
import { createSet } from "@/actions/crates";

// ---------------------------------------------------------------------------
// Sortable track row
// ---------------------------------------------------------------------------

interface SortableTrackRowProps {
  id: string;
  position: number;
  title: string | null;
  artist: string | null;
}

function SortableTrackRow({ id, position, title, artist }: SortableTrackRowProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="flex items-center gap-2 py-1.5 px-2 rounded bg-surface-container-high border border-outline-variant/10"
    >
      <button
        type="button"
        className="text-on-surface-variant/50 hover:text-on-surface-variant cursor-grab active:cursor-grabbing touch-none"
        {...attributes}
        {...listeners}
      >
        <GripVertical size={14} />
      </button>
      <span className="font-mono text-xs text-on-surface-variant w-5 flex-shrink-0">
        {position}
      </span>
      <span className="font-heading text-xs text-on-surface truncate flex-1 min-w-0">
        {title ?? "Unknown"}
      </span>
      {artist && (
        <span className="font-mono text-xs text-on-surface-variant flex-shrink-0 truncate max-w-[120px] min-w-0">
          {artist}
        </span>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// SetBuilderPanel
// ---------------------------------------------------------------------------

interface SetBuilderPanelProps {
  crateId: string;
  items: CrateItemRow[];
  onClose: () => void;
}

export function SetBuilderPanel({ crateId, items, onClose }: SetBuilderPanelProps) {
  const router = useRouter();
  const today = new Date().toISOString().split("T")[0];

  const [eventDate, setEventDate] = useState(today);
  const [venueName, setVenueName] = useState("");
  const [selectedItemIds, setSelectedItemIds] = useState<Set<string>>(new Set());
  const [trackOrder, setTrackOrder] = useState<string[]>([]);
  const [isSaving, setIsSaving] = useState(false);

  // Build a lookup map from id -> item
  const itemById = Object.fromEntries(items.map((item) => [item.id, item]));

  const handleToggleItem = (itemId: string) => {
    const isSelected = selectedItemIds.has(itemId);
    if (isSelected) {
      setSelectedItemIds((prev) => {
        const next = new Set(prev);
        next.delete(itemId);
        return next;
      });
      setTrackOrder((order) => order.filter((id) => id !== itemId));
    } else {
      setSelectedItemIds((prev) => {
        const next = new Set(prev);
        next.add(itemId);
        return next;
      });
      setTrackOrder((order) => [...order, itemId]);
    }
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (over && active.id !== over.id) {
      setTrackOrder((order) => {
        const oldIndex = order.indexOf(active.id as string);
        const newIndex = order.indexOf(over.id as string);
        return arrayMove(order, oldIndex, newIndex);
      });
    }
  };

  const handleSave = async () => {
    if (selectedItemIds.size === 0 || isSaving) return;

    setIsSaving(true);
    try {
      const result = await createSet({
        crateId,
        eventDate: eventDate || null,
        venueName: venueName || null,
        trackOrder,
      });

      if (result.success) {
        toast.success("Set saved");
        router.refresh();
        onClose();
      } else {
        toast.error(result.error ?? "Failed to save set");
      }
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="bg-surface-container rounded-lg border border-outline-variant/20 p-4 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <span className="font-mono text-xs text-primary tracking-[0.15em]">
          [SET_BUILDER]
        </span>
        <button
          type="button"
          onClick={onClose}
          className="text-on-surface-variant hover:text-on-surface transition-colors"
        >
          <X size={14} />
        </button>
      </div>

      {/* Event metadata */}
      <div className="flex gap-3">
        <div className="flex-1">
          <label className="block font-mono text-xs text-on-surface-variant mb-1">
            DATE
          </label>
          <input
            type="date"
            value={eventDate}
            onChange={(e) => setEventDate(e.target.value)}
            className="w-full bg-surface-container-high rounded border border-outline-variant/20 px-3 py-1.5 font-mono text-xs text-on-surface focus:outline-none focus:border-primary/40"
          />
        </div>
        <div className="flex-1">
          <label className="block font-mono text-xs text-on-surface-variant mb-1">
            VENUE
          </label>
          <input
            type="text"
            value={venueName}
            onChange={(e) => setVenueName(e.target.value)}
            placeholder="Venue name..."
            className="w-full bg-surface-container-high rounded border border-outline-variant/20 px-3 py-1.5 font-mono text-xs text-on-surface placeholder:text-on-surface-variant/40 focus:outline-none focus:border-primary/40"
          />
        </div>
      </div>

      {/* Track picker */}
      {items.length === 0 ? (
        <p className="font-mono text-xs text-on-surface-variant/60">
          No items in this crate yet.
        </p>
      ) : (
        <div>
          <div className="font-mono text-xs text-on-surface-variant mb-2">
            SELECT TRACKS
          </div>
          <div className="space-y-1 max-h-52 overflow-y-auto pr-1">
            {items.map((item) => (
              <label
                key={item.id}
                className="flex items-center gap-2.5 py-1 px-2 rounded hover:bg-surface-container-high cursor-pointer"
              >
                <input
                  type="checkbox"
                  checked={selectedItemIds.has(item.id)}
                  onChange={() => handleToggleItem(item.id)}
                  className="accent-primary"
                />
                {item.coverImageUrl && (
                  <img
                    src={item.coverImageUrl}
                    alt={item.title ?? ""}
                    className="w-6 h-6 rounded object-cover flex-shrink-0"
                  />
                )}
                <span className="font-heading text-xs text-on-surface truncate flex-1 min-w-0">
                  {item.title ?? "Unknown"}
                </span>
                {item.artist && (
                  <span className="font-mono text-xs text-on-surface-variant flex-shrink-0 max-w-[100px] truncate min-w-0">
                    {item.artist}
                  </span>
                )}
              </label>
            ))}
          </div>
        </div>
      )}

      {/* Ordered track list with drag-to-reorder */}
      {selectedItemIds.size > 0 && (
        <div>
          <div className="font-mono text-xs text-on-surface-variant mb-2">
            TRACK ORDER
          </div>
          <DndContext collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
            <SortableContext items={trackOrder} strategy={verticalListSortingStrategy}>
              <div className="space-y-1">
                {trackOrder.map((itemId, index) => {
                  const item = itemById[itemId];
                  if (!item) return null;
                  return (
                    <SortableTrackRow
                      key={itemId}
                      id={itemId}
                      position={index + 1}
                      title={item.title}
                      artist={item.artist}
                    />
                  );
                })}
              </div>
            </SortableContext>
          </DndContext>
        </div>
      )}

      {/* Save button */}
      <div className="flex items-center gap-3 pt-1 border-t border-outline-variant/10">
        <button
          type="button"
          onClick={handleSave}
          disabled={selectedItemIds.size === 0 || isSaving}
          className="font-mono text-xs px-3 py-1.5 rounded border border-primary/40 text-primary hover:bg-primary/10 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {isSaving ? "[SAVING...]" : "[SAVE_SET]"}
        </button>
        <span className="font-mono text-xs text-on-surface-variant">
          {selectedItemIds.size} track{selectedItemIds.size !== 1 ? "s" : ""} selected
        </span>
      </div>
    </div>
  );
}
