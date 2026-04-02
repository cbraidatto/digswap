"use client";

import { useCallback, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
	searchCollectionForShowcase,
	updateShowcase,
	type ShowcaseSlot,
} from "@/actions/profile";

interface ShowcaseRelease {
	id: string;
	title: string;
	artist: string;
	year: number | null;
	coverImageUrl: string | null;
}

interface ShowcaseCardsProps {
	searching: ShowcaseRelease | null;
	rarest:    ShowcaseRelease | null;
	favorite:  ShowcaseRelease | null;
	isOwner:   boolean;
}

const SLOT_META: Record<ShowcaseSlot, { label: string; icon: string; color: string; accent: string }> = {
	searching: { label: "Searching For",    icon: "travel_explore", color: "text-primary",   accent: "border-primary/30" },
	rarest:    { label: "Rarest Gem",        icon: "diamond",        color: "text-secondary", accent: "border-secondary/30" },
	favorite:  { label: "All-Time Favorite", icon: "favorite",       color: "text-tertiary",  accent: "border-tertiary/30" },
};

// ─── Single card ─────────────────────────────────────────────────────────────

function ShowcaseCard({
	slot,
	release,
	isOwner,
	onEdit,
}: {
	slot: ShowcaseSlot;
	release: ShowcaseRelease | null;
	isOwner: boolean;
	onEdit: (slot: ShowcaseSlot) => void;
}) {
	const meta = SLOT_META[slot];

	return (
		<div className="group relative flex flex-col rounded-lg overflow-hidden border border-outline/[0.08] bg-surface-container-high">
			{/* Cover — fixed height */}
			<div className="relative h-36 w-full overflow-hidden bg-surface-container flex-shrink-0">
				{release?.coverImageUrl ? (
					<img
						src={release.coverImageUrl}
						alt={release.title}
						className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
					/>
				) : (
					<div className="w-full h-full flex flex-col items-center justify-center gap-2">
						<span className={`material-symbols-outlined text-3xl ${meta.color} opacity-20`}>
							{meta.icon}
						</span>
						{isOwner && (
							<span className="font-mono text-[9px] uppercase tracking-widest text-outline/40">
								click to set
							</span>
						)}
					</div>
				)}

				{/* Gradient overlay at bottom */}
				{release?.coverImageUrl && (
					<div className="absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t from-black/70 to-transparent" />
				)}

				{/* Edit button — top right, appears on hover */}
				{isOwner && (
					<button
						type="button"
						onClick={() => onEdit(slot)}
						className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity w-7 h-7 flex items-center justify-center rounded bg-black/60 text-white hover:bg-black/80"
						title={release ? "Change" : "Set"}
					>
						<span className="material-symbols-outlined text-[14px]">
							{release ? "edit" : "add"}
						</span>
					</button>
				)}
			</div>

			{/* Info */}
			<div className="px-3 py-2.5 flex flex-col gap-0.5">
				<div className="flex items-center gap-1">
					<span className={`material-symbols-outlined text-xs leading-none ${meta.color}`}>
						{meta.icon}
					</span>
					<span className={`font-mono text-[9px] uppercase tracking-[0.15em] ${meta.color}`}>
						{meta.label}
					</span>
				</div>
				{release ? (
					<>
						<p className="font-heading font-bold text-[13px] text-on-surface truncate leading-tight">
							{release.title}
						</p>
						<p className="font-mono text-xs text-on-surface-variant truncate">
							{release.artist}{release.year ? ` · ${release.year}` : ""}
						</p>
					</>
				) : (
					<p className="font-mono text-xs text-outline/50 italic">not set yet</p>
				)}
			</div>
		</div>
	);
}

// ─── Picker modal ─────────────────────────────────────────────────────────────

function ShowcasePicker({
	slot,
	onClose,
	onSelect,
}: {
	slot: ShowcaseSlot;
	onClose: () => void;
	onSelect: (releaseId: string | null) => void;
}) {
	const meta = SLOT_META[slot];
	const [query, setQuery] = useState("");
	const [results, setResults] = useState<ShowcaseRelease[]>([]);
	const [isPending, startTransition] = useTransition();
	const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

	const handleQuery = useCallback((value: string) => {
		setQuery(value);
		if (debounceRef.current) clearTimeout(debounceRef.current);
		if (!value.trim()) { setResults([]); return; }

		debounceRef.current = setTimeout(() => {
			startTransition(async () => {
				const rows = await searchCollectionForShowcase(value);
				setResults(rows);
			});
		}, 300);
	}, []);

	return (
		<div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
			<div className="w-full max-w-md bg-surface-container rounded-xl border border-outline/20 shadow-2xl overflow-hidden">
				{/* Header */}
				<div className="flex items-center justify-between px-5 py-4 border-b border-outline/10">
					<div className="flex items-center gap-2">
						<span className={`material-symbols-outlined text-sm ${meta.color}`}>{meta.icon}</span>
						<span className="font-mono text-xs uppercase tracking-widest text-on-surface-variant">
							{meta.label}
						</span>
					</div>
					<button
						type="button"
						onClick={onClose}
						className="w-7 h-7 flex items-center justify-center rounded hover:bg-surface-container-high text-on-surface-variant hover:text-on-surface transition-colors"
					>
						<span className="material-symbols-outlined text-lg">close</span>
					</button>
				</div>

				{/* Search input */}
				<div className="px-5 pt-4 pb-3">
					<input
						autoFocus
						type="text"
						placeholder="Search your collection..."
						value={query}
						onChange={(e) => handleQuery(e.target.value)}
						className="w-full bg-surface-container-high border border-outline/20 rounded-lg px-3 py-2.5 font-mono text-sm text-on-surface placeholder:text-outline focus:outline-none focus:border-primary/40 transition-colors"
					/>
				</div>

				{/* Results */}
				<div className="px-5 pb-4 max-h-64 overflow-y-auto">
					{isPending && (
						<p className="font-mono text-xs text-outline py-6 text-center tracking-widest">
							SEARCHING...
						</p>
					)}
					{!isPending && query && results.length === 0 && (
						<p className="font-mono text-xs text-outline py-6 text-center">no results</p>
					)}
					{!isPending && !query && (
						<p className="font-mono text-xs text-outline/50 py-4 text-center">
							type to search your collection
						</p>
					)}
					<div className="space-y-0.5">
						{!isPending && results.map((r) => (
							<button
								key={r.id}
								type="button"
								onClick={() => onSelect(r.id)}
								className="w-full flex items-center gap-3 p-2 rounded-lg hover:bg-surface-container-high transition-colors text-left"
							>
								{r.coverImageUrl ? (
									<img
										src={r.coverImageUrl}
										alt={r.title}
										className="w-10 h-10 object-cover rounded flex-shrink-0"
									/>
								) : (
									<div className="w-10 h-10 bg-surface-container rounded flex-shrink-0 flex items-center justify-center">
										<span className="material-symbols-outlined text-sm text-outline">album</span>
									</div>
								)}
								<div className="flex-1 min-w-0">
									<p className="font-heading font-bold text-sm text-on-surface truncate">{r.title}</p>
									<p className="font-mono text-xs text-on-surface-variant truncate">
										{r.artist}{r.year ? ` · ${r.year}` : ""}
									</p>
								</div>
							</button>
						))}
					</div>
				</div>

				{/* Footer */}
				<div className="px-5 py-3 border-t border-outline/10 flex items-center justify-between">
					<button
						type="button"
						onClick={() => onSelect(null)}
						className="font-mono text-xs uppercase tracking-widest text-outline hover:text-on-surface-variant transition-colors"
					>
						clear slot
					</button>
					<button
						type="button"
						onClick={onClose}
						className="font-mono text-xs uppercase tracking-widest text-on-surface-variant hover:text-on-surface transition-colors"
					>
						cancel
					</button>
				</div>
			</div>
		</div>
	);
}

// ─── Main component ───────────────────────────────────────────────────────────

export function ShowcaseCards({ searching, rarest, favorite, isOwner }: ShowcaseCardsProps) {
	const router = useRouter();
	const [activeSlot, setActiveSlot] = useState<ShowcaseSlot | null>(null);
	const [isSaving, startSaving] = useTransition();

	function handleSelect(releaseId: string | null) {
		if (!activeSlot) return;
		const slot = activeSlot;
		setActiveSlot(null);
		startSaving(async () => {
			await updateShowcase(slot, releaseId);
			router.refresh();
		});
	}

	return (
		<>
			<div className={`grid grid-cols-3 gap-3 transition-opacity ${isSaving ? "opacity-50 pointer-events-none" : ""}`}>
				<ShowcaseCard slot="searching" release={searching} isOwner={isOwner} onEdit={setActiveSlot} />
				<ShowcaseCard slot="rarest"    release={rarest}    isOwner={isOwner} onEdit={setActiveSlot} />
				<ShowcaseCard slot="favorite"  release={favorite}  isOwner={isOwner} onEdit={setActiveSlot} />
			</div>

			{activeSlot && (
				<ShowcasePicker
					slot={activeSlot}
					onClose={() => setActiveSlot(null)}
					onSelect={handleSelect}
				/>
			)}
		</>
	);
}
