"use client";

import { useEffect, useState } from "react";

export type ViewMode = "grid" | "list";

const STORAGE_KEY = "collection-view-mode";

interface CollectionViewToggleProps {
	onChange: (mode: ViewMode) => void;
}

export function CollectionViewToggle({ onChange }: CollectionViewToggleProps) {
	const [mode, setMode] = useState<ViewMode>("list");

	// Hydrate from localStorage on mount
	useEffect(() => {
		const stored = localStorage.getItem(STORAGE_KEY);
		if (stored === "grid" || stored === "list") {
			setMode(stored);
			onChange(stored);
		}
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [onChange]);

	const select = (next: ViewMode) => {
		setMode(next);
		localStorage.setItem(STORAGE_KEY, next);
		onChange(next);
	};

	return (
		<div className="flex items-center gap-1 border border-outline-variant/20 rounded-md p-0.5 bg-surface-container-low">
			<button
				type="button"
				onClick={() => select("list")}
				aria-label="List view"
				className={`p-1.5 rounded transition-colors ${
					mode === "list"
						? "bg-primary/15 text-primary"
						: "text-on-surface-variant hover:text-on-surface"
				}`}
			>
				<span className="material-symbols-outlined text-base leading-none">view_list</span>
			</button>
			<button
				type="button"
				onClick={() => select("grid")}
				aria-label="Grid view"
				className={`p-1.5 rounded transition-colors ${
					mode === "grid"
						? "bg-primary/15 text-primary"
						: "text-on-surface-variant hover:text-on-surface"
				}`}
			>
				<span className="material-symbols-outlined text-base leading-none">grid_view</span>
			</button>
		</div>
	);
}
