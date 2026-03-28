"use client";

import { useDiggerMemory } from "@/hooks/use-digger-memory";
import type { LeadTargetType } from "@/lib/db/schema/leads";

const statusColors: Record<string, string> = {
  watching: "bg-secondary",
  contacted: "bg-primary",
  dead_end: "bg-on-surface-variant",
  found: "bg-tertiary",
};

interface ContextTooltipProps {
  type: LeadTargetType;
  id: string;
}

export function ContextTooltip({ type, id }: ContextTooltipProps) {
  const { lead, isLoading } = useDiggerMemory(type, id);

  if (isLoading || !lead) return null;

  const colorClass = statusColors[lead.status] ?? "bg-on-surface-variant";
  const preview = lead.note ? lead.note.slice(0, 60) : lead.status.toUpperCase();

  return (
    <span
      className="group relative inline-flex items-center gap-1 cursor-default"
      title={preview}
    >
      <span
        className={`w-2 h-2 rounded-full ${colorClass} flex-shrink-0`}
      />
      <span className="font-mono text-[9px] text-on-surface-variant hidden group-hover:inline">
        {preview}
      </span>
    </span>
  );
}
