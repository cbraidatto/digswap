"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { Disc3, ChevronRight } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { useImportStore } from "@/stores/import-store";
import { getImportChannelName } from "@/lib/discogs/types";
import type { DiscogsProgressPayload } from "@/lib/discogs/types";

interface ImportBannerProps {
	userId: string;
}

export function ImportBanner({ userId }: ImportBannerProps) {
	const router = useRouter();
	const { isActive, processedItems, totalItems, type, updateProgress } =
		useImportStore();
	const channelRef = useRef<ReturnType<
		ReturnType<typeof createClient>["channel"]
	> | null>(null);

	// Subscribe to Supabase Realtime channel for import progress
	useEffect(() => {
		const supabase = createClient();
		const channelName = getImportChannelName(userId);
		const channel = supabase.channel(`${channelName}-banner`);

		channel
			.on("broadcast", { event: "progress" }, (payload) => {
				const data = payload.payload as DiscogsProgressPayload;
				updateProgress(data);
			})
			.subscribe();

		channelRef.current = channel;

		return () => {
			supabase.removeChannel(channel);
			channelRef.current = null;
		};
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [userId]);

	// Don't render when no active import
	if (!isActive) {
		return null;
	}

	const bannerText =
		type === "sync"
			? `Syncing... ${processedItems.toLocaleString()}/${totalItems.toLocaleString()}`
			: `Importing... ${processedItems.toLocaleString()}/${totalItems.toLocaleString()}`;

	const ariaLabel = `Import in progress, ${processedItems} of ${totalItems} records. Tap to view details.`;

	return (
		<div
			role="status"
			aria-live="polite"
			aria-label={ariaLabel}
			className="sticky top-[56px] left-0 right-0 z-[35] flex h-11 cursor-pointer items-center gap-2 border-b bg-secondary px-4"
			onClick={() => router.push("/import-progress")}
			onKeyDown={(e) => {
				if (e.key === "Enter" || e.key === " ") {
					e.preventDefault();
					router.push("/import-progress");
				}
			}}
			tabIndex={0}
		>
			<Disc3
				className="size-4 text-primary animate-spin"
				style={{ animationDuration: "2s" }}
				aria-hidden="true"
			/>
			<span className="text-sm text-muted-foreground">{bannerText}</span>
			<ChevronRight className="ml-auto size-4 text-muted-foreground" />
		</div>
	);
}
