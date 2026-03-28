"use client";

import { useState, useEffect } from "react";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useDiggerMemory } from "@/hooks/use-digger-memory";
import type { LeadTargetType, LeadStatus } from "@/lib/db/schema/leads";

interface QuickNotePopoverProps {
  entityType: LeadTargetType;
  entityId: string;
  children: React.ReactNode;
}

export function QuickNotePopover({
  entityType,
  entityId,
  children,
}: QuickNotePopoverProps) {
  const { lead, save, isLoading } = useDiggerMemory(entityType, entityId);
  const [note, setNote] = useState("");
  const [status, setStatus] = useState<LeadStatus>("watching");
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (open && lead) {
      setNote(lead.note ?? "");
      setStatus(lead.status as LeadStatus);
    }
  }, [open, lead]);

  const handleSave = async () => {
    await save(note || null, status);
    setOpen(false);
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger render={<span className="inline-flex" />}>
        {children}
      </PopoverTrigger>
      <PopoverContent className="w-72 p-4 bg-surface-container border-outline-variant/20">
        <div className="space-y-3">
          <p className="font-mono text-[10px] text-primary tracking-[0.15em]">
            [ADD_NOTE]
          </p>
          <Textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            onBlur={handleSave}
            placeholder="Notes on this lead..."
            className="font-mono text-[11px] bg-surface-container-low border-outline-variant/20 resize-none h-20"
          />
          <Select
            value={status}
            onValueChange={(v) => setStatus(v as LeadStatus)}
          >
            <SelectTrigger className="font-mono text-[11px] bg-surface-container-low border-outline-variant/20 h-8">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="bg-surface-container border-outline-variant/20 font-mono text-[11px]">
              <SelectItem value="watching">[WATCHING]</SelectItem>
              <SelectItem value="contacted">[CONTACTED]</SelectItem>
              <SelectItem value="dead_end">[DEAD_END]</SelectItem>
              <SelectItem value="found">[FOUND]</SelectItem>
            </SelectContent>
          </Select>
          <Button
            onClick={handleSave}
            size="sm"
            className="w-full font-mono text-[10px] bg-primary-container text-on-primary-container h-7"
            disabled={isLoading}
          >
            SAVE_LEAD
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
