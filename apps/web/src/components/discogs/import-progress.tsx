"use client";

import { AlertCircle, CheckCircle2, Disc3 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import type { DiscogsProgressPayload } from "@/lib/discogs/types";
import { getImportChannelName } from "@/lib/discogs/types";
import { createClient } from "@/lib/supabase/client";
import { useImportStore } from "@/stores/import-store";

interface InitialJob {
	id: string;
	type: string;
	status: string;
	processedItems: number;
	totalItems: number;
	currentRecord: string | null;
}

interface ImportProgressProps {
	userId: string;
	initialJob: InitialJob | null;
}

export function ImportProgress({ userId, initialJob }: ImportProgressProps) {
	const router = useRouter();
	const store = useImportStore();
	const channelRef = useRef<ReturnType<ReturnType<typeof createClient>["channel"]> | null>(null);
	const redirectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
	const hydratedRef = useRef(false);

	// Hydrate store from server-rendered initial job data
	useEffect(() => {
		if (initialJob && !hydratedRef.current) {
			hydratedRef.current = true;
			store.updateProgress({
				jobId: initialJob.id,
				type: initialJob.type as DiscogsProgressPayload["type"],
				status: initialJob.status as DiscogsProgressPayload["status"],
				processedItems: initialJob.processedItems,
				totalItems: initialJob.totalItems,
				currentRecord: initialJob.currentRecord,
			});
		}
	}, [initialJob, store]);

	// Subscribe to Supabase Realtime channel for live updates
	useEffect(() => {
		const supabase = createClient();
		const channelName = getImportChannelName(userId);
		const channel = supabase.channel(channelName);

		channel
			.on("broadcast", { event: "progress" }, (payload) => {
				const data = payload.payload as DiscogsProgressPayload;
				store.updateProgress(data);
			})
			.subscribe();

		channelRef.current = channel;

		return () => {
			supabase.removeChannel(channel);
			channelRef.current = null;
		};
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [userId, store.updateProgress]);

	// Auto-redirect to /perfil on completion (D-06)
	useEffect(() => {
		if (store.status === "completed") {
			redirectTimerRef.current = setTimeout(() => {
				router.push("/perfil");
			}, 2000);
		}

		return () => {
			if (redirectTimerRef.current) {
				clearTimeout(redirectTimerRef.current);
			}
		};
	}, [store.status, router]);

	const percent =
		store.totalItems > 0 ? Math.round((store.processedItems / store.totalItems) * 100) : 0;

	// Skeleton state: before data loads
	if (!initialJob && !store.jobId) {
		return (
			<div className="flex flex-col items-center pt-[48px]">
				<Disc3 className="size-12 text-primary" aria-hidden="true" />
				<div className="mt-[32px] w-full max-w-md mx-auto px-4">
					<Card>
						<CardContent className="p-6 space-y-4">
							<div className="skeleton-shimmer h-6 rounded" style={{ width: 200 }} />
							<div className="skeleton-shimmer h-1 w-full rounded-full" />
							<div className="skeleton-shimmer h-4 rounded" style={{ width: 120 }} />
							<div className="skeleton-shimmer h-4 rounded" style={{ width: 180 }} />
						</CardContent>
					</Card>
				</div>
			</div>
		);
	}

	// Success state
	if (store.status === "completed") {
		return (
			<div className="flex flex-col items-center pt-[48px]">
				<CheckCircle2 className="size-12 text-success" aria-hidden="true" />
				<div className="mt-[32px] w-full max-w-md mx-auto px-4">
					<Card>
						<CardContent className="p-6 space-y-4">
							<h1 className="font-heading text-xl font-semibold text-foreground">
								Import complete!
							</h1>
							<Progress value={100} aria-label="Import progress" />
							<p className="text-sm text-muted-foreground">
								{store.totalItems.toLocaleString()} records imported
							</p>
							<p className="text-base text-muted-foreground">Redirecting to your collection...</p>
						</CardContent>
					</Card>
				</div>
			</div>
		);
	}

	// Error state
	if (store.status === "failed") {
		return (
			<div className="flex flex-col items-center pt-[48px]">
				<AlertCircle className="size-12 text-destructive" aria-hidden="true" />
				<div className="mt-[32px] w-full max-w-md mx-auto px-4">
					<Card>
						<CardContent className="p-6 space-y-4">
							<h1 className="font-heading text-xl font-semibold text-foreground">Import paused</h1>
							<p className="text-sm text-muted-foreground">
								Something went wrong during import. Your progress has been saved -- tap retry to
								continue where you left off.
							</p>
							<Button onClick={() => router.push("/settings")} className="w-full">
								Retry Import
							</Button>
						</CardContent>
					</Card>
				</div>
			</div>
		);
	}

	// Active importing state (collection or wantlist)
	const heading =
		store.type === "wantlist" ? "Importing your wantlist" : "Importing your collection";

	return (
		<div className="flex flex-col items-center pt-[48px]">
			<Disc3
				className="size-12 text-primary animate-spin"
				style={{ animationDuration: "2s" }}
				aria-hidden="true"
			/>
			<div className="mt-[32px] w-full max-w-md mx-auto px-4">
				<Card>
					<CardContent className="p-6 space-y-4">
						<h1 className="font-heading text-xl font-semibold text-foreground">{heading}</h1>
						<Progress
							value={percent}
							aria-label="Import progress"
							aria-valuenow={store.processedItems}
							aria-valuemin={0}
							aria-valuemax={store.totalItems}
						/>
						<p className="text-sm text-muted-foreground">
							{store.processedItems.toLocaleString()} / {store.totalItems.toLocaleString()} records
						</p>
						{store.currentRecord && (
							<div aria-live="polite">
								<p className="text-sm text-muted-foreground">Currently importing:</p>
								<p className="text-base text-foreground">{store.currentRecord}</p>
							</div>
						)}
					</CardContent>
				</Card>
			</div>
		</div>
	);
}
