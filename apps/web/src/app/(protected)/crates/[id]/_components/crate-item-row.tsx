"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { moveToCollection, moveToWantlist, removeCrateItem } from "@/actions/crates";
import { CoverArt } from "@/components/ui/cover-art";
import { RecordLink } from "@/components/ui/record-link";
import type { CrateItemRow as CrateItemRowType } from "@/lib/crates/types";

interface CrateItemRowProps {
	item: CrateItemRowType;
}

export function CrateItemRow({ item }: CrateItemRowProps) {
	const router = useRouter();
	const [isMoving, setIsMoving] = useState(false);

	const handleMoveToWantlist = async () => {
		setIsMoving(true);
		try {
			const result = await moveToWantlist(item.id);
			if (result.success) {
				toast.success("Moved to wantlist");
				router.refresh();
			} else {
				toast.error(result.error ?? "Failed to move to wantlist");
			}
		} finally {
			setIsMoving(false);
		}
	};

	const handleMoveToCollection = async () => {
		setIsMoving(true);
		try {
			const result = await moveToCollection(item.id);
			if (result.success) {
				toast.success("Moved to collection");
				router.refresh();
			} else {
				toast.error(result.error ?? "Failed to move to collection");
			}
		} finally {
			setIsMoving(false);
		}
	};

	return (
		<div
			className={`flex items-center gap-3 py-2 border-b border-outline-variant/10 last:border-b-0 ${
				item.status === "found" ? "opacity-50" : ""
			}`}
		>
			{/* Cover image */}
			<CoverArt src={item.coverImageUrl} alt={item.title ?? "Record cover"} size="sm" />

			{/* Title + artist */}
			<div className="flex-1 min-w-0">
				<RecordLink discogsId={item.discogsId}>
					<p className="font-heading text-sm font-semibold text-on-surface hover:text-primary transition-colors truncate">
						{item.title ?? "Unknown"}
					</p>
				</RecordLink>
				{item.artist && (
					<p className="font-mono text-xs text-on-surface-variant truncate">{item.artist}</p>
				)}
			</div>

			{/* Status / actions */}
			<div className="flex-shrink-0 flex items-center gap-2">
				{item.status === "found" ? (
					<span className="font-mono text-xs px-1.5 py-0.5 rounded border text-tertiary border-tertiary/30">
						[FOUND]
					</span>
				) : (
					<>
						<button
							type="button"
							onClick={handleMoveToWantlist}
							disabled={isMoving}
							className="font-mono text-xs px-2 py-1 rounded border border-outline-variant/20 text-on-surface-variant hover:bg-surface-container-high transition-colors disabled:opacity-50"
						>
							[→ WANTLIST]
						</button>
						<button
							type="button"
							onClick={handleMoveToCollection}
							disabled={isMoving}
							className="font-mono text-xs px-2 py-1 rounded border border-outline-variant/20 text-on-surface-variant hover:bg-surface-container-high transition-colors disabled:opacity-50"
						>
							[→ COLLECTION]
						</button>
						<button
							type="button"
							onClick={async () => {
								setIsMoving(true);
								try {
									const result = await removeCrateItem(item.id);
									if (result.success) {
										toast.success("Removed from crate");
										router.refresh();
									} else {
										toast.error(result.error ?? "Failed to remove");
									}
								} finally {
									setIsMoving(false);
								}
							}}
							disabled={isMoving}
							className="font-mono text-xs px-1.5 py-1 rounded text-on-surface-variant/50 hover:text-destructive transition-colors disabled:opacity-50"
							title="Remove from crate"
						>
							<span className="material-symbols-outlined text-sm">close</span>
						</button>
					</>
				)}
			</div>
		</div>
	);
}
