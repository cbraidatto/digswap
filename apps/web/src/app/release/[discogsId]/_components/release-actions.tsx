"use client";

import { useTransition } from "react";
import { toast } from "sonner";
import { addRecordToCollection } from "@/actions/collection";
import { addToWantlist } from "@/actions/wantlist";
import { AddToCrateButton } from "@/components/crates/add-to-crate-button";

interface ReleaseActionsProps {
	releaseId: string;
	discogsId: number | null;
	title: string;
	artist: string;
	coverImageUrl: string | null;
}

export function ReleaseActions({
	releaseId,
	discogsId,
	title,
	artist,
	coverImageUrl,
}: ReleaseActionsProps) {
	const [collectionPending, startCollectionTransition] = useTransition();
	const [wantlistPending, startWantlistTransition] = useTransition();

	function handleAddToCollection() {
		if (!discogsId) return;
		startCollectionTransition(async () => {
			const result = await addRecordToCollection(discogsId);
			if (result.error) {
				toast.error(result.error);
			} else {
				toast.success("Added to collection");
			}
		});
	}

	function handleAddToWantlist() {
		if (!discogsId) return;
		startWantlistTransition(async () => {
			const result = await addToWantlist(discogsId);
			if (result.error) {
				toast.error(result.error);
			} else {
				toast.success("Added to wantlist");
			}
		});
	}

	return (
		<div className="flex items-center gap-2 flex-wrap">
			{discogsId && (
				<>
					<button
						type="button"
						onClick={handleAddToCollection}
						disabled={collectionPending}
						className="inline-flex items-center gap-1.5 bg-primary text-background font-mono text-xs px-3 py-2 rounded hover:opacity-90 disabled:opacity-50 transition-opacity"
					>
						<span className="material-symbols-outlined text-sm">add</span>
						{collectionPending ? "..." : "Collection"}
					</button>
					<button
						type="button"
						onClick={handleAddToWantlist}
						disabled={wantlistPending}
						className="inline-flex items-center gap-1.5 border border-outline-variant text-on-surface-variant font-mono text-xs px-3 py-2 rounded hover:bg-surface-container-high disabled:opacity-50 transition-colors"
					>
						<span className="material-symbols-outlined text-sm">favorite</span>
						{wantlistPending ? "..." : "Wantlist"}
					</button>
				</>
			)}
			<AddToCrateButton
				releaseId={releaseId}
				discogsId={discogsId}
				title={title}
				artist={artist}
				coverImageUrl={coverImageUrl}
			/>
		</div>
	);
}
