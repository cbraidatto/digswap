"use client";

import { useDiggerMemory } from "@/hooks/use-digger-memory";
import { QuickNotePopover } from "./quick-note-popover";
import type { LeadTargetType } from "@/lib/db/schema/leads";

const statusDotColors: Record<string, string> = {
  watching: "bg-secondary",
  contacted: "bg-primary",
  dead_end: "bg-on-surface-variant",
  found: "bg-tertiary",
};

interface LeadActionProps {
  type: LeadTargetType;
  id: string;
}

export function LeadAction({ type, id }: LeadActionProps) {
  const { lead } = useDiggerMemory(type, id);
  const dotColor = lead
    ? (statusDotColors[lead.status] ?? "bg-on-surface-variant")
    : null;

  return (
    <QuickNotePopover entityType={type} entityId={id}>
      <button
        type="button"
        className="relative inline-flex items-center justify-center w-7 h-7 rounded hover:bg-surface-container-high transition-colors"
        title="Add note / track lead"
        aria-label="Track this lead"
      >
        <span className="material-symbols-outlined text-[14px] text-on-surface-variant">
          bookmark
        </span>
        {dotColor && (
          <span
            className={`absolute top-0.5 right-0.5 w-2 h-2 rounded-full ${dotColor} border border-surface-container`}
          />
        )}
      </button>
    </QuickNotePopover>
  );
}
