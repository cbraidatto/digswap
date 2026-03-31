"use client";

/**
 * Standalone CTA button that initiates the web→desktop handoff for a trade.
 *
 * Calls generateHandoffToken server action, then redirects to /desktop/open
 * with the trade ID and short-TTL token. The handoff page handles the actual
 * digswap:// protocol open and install detection.
 *
 * This component is intentionally standalone — the consuming trade detail
 * page wires it in Phase 17-06.
 *
 * Usage:
 *   <OpenInDesktopButton tradeId={trade.id} />
 *
 * See: ADR-002-desktop-trade-runtime.md D-08
 */

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { generateHandoffToken } from "@/actions/desktop";

interface OpenInDesktopButtonProps {
  tradeId: string;
  className?: string;
}

export function OpenInDesktopButton({
  tradeId,
  className,
}: OpenInDesktopButtonProps) {
  const router = useRouter();
  const [isPending, setIsPending] = useState(false);

  async function handleClick() {
    setIsPending(true);
    try {
      const result = await generateHandoffToken(tradeId);

      if ("error" in result) {
        toast.error(result.error);
        return;
      }

      // Redirect to the handoff intermediary page — it fires the protocol handler
      router.push(
        `/desktop/open?trade=${encodeURIComponent(tradeId)}&token=${encodeURIComponent(result.token)}`,
      );
    } catch {
      toast.error("Failed to launch desktop app. Please try again.");
    } finally {
      setIsPending(false);
    }
  }

  return (
    <Button
      onClick={handleClick}
      disabled={isPending}
      className={className}
      size="lg"
    >
      {isPending ? (
        <>
          <span
            className="size-4 rounded-full border-2 border-primary-foreground/40 border-t-primary-foreground animate-spin"
            aria-hidden
          />
          Preparing&hellip;
        </>
      ) : (
        "Open in Desktop App"
      )}
    </Button>
  );
}
