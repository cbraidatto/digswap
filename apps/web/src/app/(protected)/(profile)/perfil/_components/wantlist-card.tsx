"use client";

import { useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import type { WantlistItem } from "@/lib/wantlist/queries";
import { markAsFound, removeFromWantlist } from "@/actions/wantlist";
import { RarityPill } from "@/components/ui/rarity-pill";
import { RecordLink } from "@/components/ui/record-link";
import { RecordContextMenu } from "@/components/ui/record-context-menu";

interface WantlistCardProps {
	item: WantlistItem;
	isOwner: boolean;
}

export function WantlistCard({ item, isOwner }: WantlistCardProps) {
	const router = useRouter();
	const [isPending, setIsPending] = useState(false);
	const isFound = item.foundAt !== null;

	const handleMarkFound = async () => {
		setIsPending(true);
		try {
			const res = await markAsFound(item.id);
			if (res.error) {
				toast.error(res.error);
			} else {
				toast.success("Marked as found!");
				router.refresh();
			}
		} finally {
			setIsPending(false);
		}
	};

	const handleRemove = async () => {
		setIsPending(true);
		try {
			const res = await removeFromWantlist(item.id);
			if (res.error) {
				toast.error(res.error);
			} else {
				router.refresh();
			}
		} finally {
			setIsPending(false);
		}
	};

	return (
		<div className={`group relative bg-surface-container-low rounded-lg overflow-hidden border transition-all hover:shadow-lg ${
			isFound
				? "border-primary/20 opacity-60 hover:opacity-80"
				: "border-outline-variant/10 hover:border-secondary/30 hover:shadow-secondary/5"
		}`}>
			{/* Cover Art */}
			<div className="relative aspect-square bg-surface-container-high">
				{item.coverImageUrl ? (
					<Image
						src={item.coverImageUrl}
						alt={`${item.title} by ${item.artist}`}
						fill
						sizes="(max-width: 768px) 50vw, (max-width: 1024px) 33vw, 25vw"
						className="object-cover"
					/>
				) : (
					<div className="absolute inset-0 flex items-center justify-center">
						<span className="material-symbols-outlined text-4xl text-on-surface-variant/30">
							album
						</span>
					</div>
				)}

				{/* Status badge */}
				<div className="absolute bottom-2 left-2">
					{isFound ? (
						<span className="inline-flex items-center gap-1 bg-primary/20 border border-primary/40 text-primary font-mono text-[9px] uppercase tracking-widest px-1.5 py-0.5 rounded">
							<span className="material-symbols-outlined text-xs">task_alt</span>
							Found
						</span>
					) : (
						<span className="inline-flex items-center gap-1 bg-secondary/10 border border-secondary/30 text-secondary font-mono text-[9px] uppercase tracking-widest px-1.5 py-0.5 rounded">
							<span className="material-symbols-outlined text-xs">manage_search</span>
							Hunting
						</span>
					)}
				</div>

				{/* Owner actions overlay */}
				{isOwner && !isFound && (
					<div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
						<button
							type="button"
							onClick={handleMarkFound}
							disabled={isPending}
							title="Mark as found"
							className="flex flex-col items-center gap-1 px-3 py-2 rounded-lg bg-primary/20 border border-primary/40 text-primary hover:bg-primary/30 transition-colors disabled:opacity-50"
						>
							<span className="material-symbols-outlined text-lg">task_alt</span>
							<span className="font-mono text-[9px]">Found it</span>
						</button>
						<button
							type="button"
							onClick={handleRemove}
							disabled={isPending}
							title="Remove from wantlist"
							className="flex flex-col items-center gap-1 px-3 py-2 rounded-lg bg-destructive/10 border border-destructive/30 text-destructive hover:bg-destructive/20 transition-colors disabled:opacity-50"
						>
							<span className="material-symbols-outlined text-lg">delete</span>
							<span className="font-mono text-[9px]">Remove</span>
						</button>
					</div>
				)}

				{isOwner && isFound && (
					<div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
						<button
							type="button"
							onClick={handleRemove}
							disabled={isPending}
							title="Remove from wantlist"
							className="flex flex-col items-center gap-1 px-3 py-2 rounded-lg bg-destructive/10 border border-destructive/30 text-destructive hover:bg-destructive/20 transition-colors disabled:opacity-50"
						>
							<span className="material-symbols-outlined text-lg">delete</span>
							<span className="font-mono text-[9px]">Remove</span>
						</button>
					</div>
				)}
			</div>

			{/* Info */}
			<div className="p-3">
				<div className="flex items-start justify-between gap-1">
					<RecordLink discogsId={item.discogsId}>
						<h3 className="font-heading text-sm font-bold text-on-surface hover:text-primary transition-colors truncate">
							{item.title ?? "Unknown"}
						</h3>
					</RecordLink>
					<RecordContextMenu
						discogsId={item.discogsId}
						title={item.title}
						artist={item.artist}
						hideAdd
					/>
				</div>
				<p className="text-xs text-on-surface-variant truncate">
					{item.artist ?? "Unknown Artist"}
				</p>
				<div className="mt-1.5 flex items-center gap-2">
					<RarityPill score={item.rarityScore} showScore={false} />
					{item.huntingCount > 0 && (
						<span className="font-mono text-[9px] text-secondary">
							<span className="material-symbols-outlined text-[10px] align-middle mr-0.5">group</span>
							{item.huntingCount} hunting
						</span>
					)}
				</div>
				{item.notes && (
					<p className="mt-1.5 text-xs font-mono text-on-surface-variant/60 line-clamp-2 leading-relaxed">
						{item.notes}
					</p>
				)}
			</div>
		</div>
	);
}
