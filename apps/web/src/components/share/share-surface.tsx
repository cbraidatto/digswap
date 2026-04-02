"use client";

import { useState } from "react";

interface ShareSurfaceProps {
  url: string;
  label?: string;
}

export function ShareSurface({ url, label = "COPY_LINK" }: ShareSurfaceProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleShare = async () => {
    if (navigator.share) {
      await navigator.share({ url });
    } else {
      handleCopy();
    }
  };

  return (
    <div className="flex items-center gap-2">
      <button
        type="button"
        onClick={handleCopy}
        className="font-mono text-xs text-primary hover:underline flex items-center gap-1"
      >
        <span className="material-symbols-outlined text-[12px]">
          {copied ? "check" : "content_copy"}
        </span>
        {copied ? "COPIED" : label}
      </button>
      {typeof navigator !== "undefined" && "share" in navigator && (
        <button
          type="button"
          onClick={handleShare}
          className="font-mono text-xs text-on-surface-variant hover:text-primary flex items-center gap-1"
        >
          <span className="material-symbols-outlined text-[12px]">share</span>
          SHARE
        </button>
      )}
    </div>
  );
}
