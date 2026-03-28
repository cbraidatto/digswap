"use client";

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { ShareSurface } from "@/components/share/share-surface";

interface RarityCardModalProps {
  username: string;
  appUrl: string;
}

export function RarityCardModal({ username, appUrl }: RarityCardModalProps) {
  const [open, setOpen] = useState(false);
  const cardUrl = `${appUrl}/api/og/rarity/${username}`;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger>
        <button
          type="button"
          className="font-mono text-[10px] text-on-surface-variant hover:text-primary transition-colors"
        >
          GENERATE_RARITY_CARD
        </button>
      </DialogTrigger>
      <DialogContent className="bg-surface-container border-outline-variant/20 sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle className="font-mono text-[10px] text-primary tracking-[0.15em]">
            [RARITY_SCORE_CARD]
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={cardUrl}
            alt="Rarity Score Card"
            className="w-full rounded"
            style={{ aspectRatio: "1200/630" }}
          />
          <ShareSurface url={cardUrl} label="SHARE_RARITY_CARD" />
        </div>
      </DialogContent>
    </Dialog>
  );
}
