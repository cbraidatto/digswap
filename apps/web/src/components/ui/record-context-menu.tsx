"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { addRecordToCollection } from "@/actions/collection";
import { addToWantlist } from "@/actions/wantlist";

interface RecordContextMenuProps {
	discogsId: number | null | undefined;
	releaseId?: string;
	title?: string;
	artist?: string;
	/** Hide "Add to Collection" (e.g., when viewing own collection) */
	hideAdd?: boolean;
	/** Hide "Add to Wantlist" */
	hideWantlist?: boolean;
}

export function RecordContextMenu({
	discogsId,
	releaseId,
	title,
	artist,
	hideAdd = false,
	hideWantlist = false,
}: RecordContextMenuProps) {
	const [open, setOpen] = useState(false);
	const [pending, setPending] = useState(false);
	const menuRef = useRef<HTMLDivElement>(null);

	// Close on click outside
	useEffect(() => {
		if (!open) return;
		function handleClick(e: MouseEvent) {
			if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
				setOpen(false);
			}
		}
		document.addEventListener("mousedown", handleClick);
		return () => document.removeEventListener("mousedown", handleClick);
	}, [open]);

	// Close on Escape
	useEffect(() => {
		if (!open) return;
		function handleKey(e: KeyboardEvent) {
			if (e.key === "Escape") setOpen(false);
		}
		document.addEventListener("keydown", handleKey);
		return () => document.removeEventListener("keydown", handleKey);
	}, [open]);

	async function handleAddToCollection() {
		if (!discogsId) return;
		setPending(true);
		try {
			const result = await addRecordToCollection(discogsId);
			if (result.error) toast.error(result.error);
			else toast.success("Added to collection");
		} finally {
			setPending(false);
			setOpen(false);
		}
	}

	async function handleAddToWantlist() {
		if (!discogsId) return;
		setPending(true);
		try {
			const result = await addToWantlist(discogsId);
			if (result.error) toast.error(result.error);
			else toast.success("Added to wantlist");
		} finally {
			setPending(false);
			setOpen(false);
		}
	}

	function handleShare() {
		const url = discogsId ? `${window.location.origin}/release/${discogsId}` : window.location.href;
		const text = title
			? `${title}${artist ? ` by ${artist}` : ""} on DigSwap`
			: "Check this out on DigSwap";

		if (navigator.share) {
			navigator.share({ title: text, url }).catch(() => {});
		} else {
			navigator.clipboard.writeText(url).then(() => toast.success("Link copied"));
		}
		setOpen(false);
	}

	return (
		<div ref={menuRef} className="relative">
			<button
				type="button"
				onClick={(e) => {
					e.preventDefault();
					e.stopPropagation();
					setOpen(!open);
				}}
				className="p-1 rounded text-on-surface-variant/40 hover:text-on-surface hover:bg-surface-container-high transition-colors"
				aria-label="More actions"
			>
				<span className="material-symbols-outlined text-[18px]">more_vert</span>
			</button>

			{open && (
				<div className="absolute right-0 top-full mt-1 bg-surface-container border border-outline-variant/15 rounded-lg shadow-xl shadow-black/15 z-50 min-w-[180px] py-1 animate-in fade-in zoom-in-95 duration-100">
					{discogsId && (
						<Link
							href={`/release/${discogsId}`}
							onClick={() => setOpen(false)}
							className="flex items-center gap-2.5 px-3 py-2 font-mono text-xs text-on-surface hover:bg-surface-container-high transition-colors w-full"
						>
							<span className="material-symbols-outlined text-[16px] text-on-surface-variant">
								album
							</span>
							View release
						</Link>
					)}

					{!hideAdd && discogsId && (
						<button
							type="button"
							onClick={handleAddToCollection}
							disabled={pending}
							className="flex items-center gap-2.5 px-3 py-2 font-mono text-xs text-on-surface hover:bg-surface-container-high transition-colors w-full disabled:opacity-50"
						>
							<span className="material-symbols-outlined text-[16px] text-on-surface-variant">
								add_circle
							</span>
							Add to collection
						</button>
					)}

					{!hideWantlist && discogsId && (
						<button
							type="button"
							onClick={handleAddToWantlist}
							disabled={pending}
							className="flex items-center gap-2.5 px-3 py-2 font-mono text-xs text-on-surface hover:bg-surface-container-high transition-colors w-full disabled:opacity-50"
						>
							<span className="material-symbols-outlined text-[16px] text-on-surface-variant">
								favorite
							</span>
							Add to wantlist
						</button>
					)}

					<button
						type="button"
						onClick={handleShare}
						className="flex items-center gap-2.5 px-3 py-2 font-mono text-xs text-on-surface hover:bg-surface-container-high transition-colors w-full"
					>
						<span className="material-symbols-outlined text-[16px] text-on-surface-variant">
							share
						</span>
						Share
					</button>
				</div>
			)}
		</div>
	);
}
