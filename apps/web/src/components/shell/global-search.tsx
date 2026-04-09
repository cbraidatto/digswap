"use client";

import Image from "next/image";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import { type GlobalSearchResult, globalSearchAction } from "@/actions/search";

export function GlobalSearch() {
	const [query, setQuery] = useState("");
	const [results, setResults] = useState<GlobalSearchResult | null>(null);
	const [isOpen, setIsOpen] = useState(false);
	const [isPending, startTransition] = useTransition();
	const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
	const containerRef = useRef<HTMLDivElement>(null);

	const search = useCallback((value: string) => {
		if (value.trim().length < 2) {
			setResults(null);
			setIsOpen(false);
			return;
		}
		startTransition(async () => {
			const data = await globalSearchAction(value);
			setResults(data);
			setIsOpen(true);
		});
	}, []);

	function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
		const value = e.target.value;
		setQuery(value);
		if (timeoutRef.current) clearTimeout(timeoutRef.current);
		timeoutRef.current = setTimeout(() => search(value), 300);
	}

	function handleClose() {
		setIsOpen(false);
	}

	// Close on click outside
	useEffect(() => {
		function handleClickOutside(e: MouseEvent) {
			if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
				setIsOpen(false);
			}
		}
		document.addEventListener("mousedown", handleClickOutside);
		return () => document.removeEventListener("mousedown", handleClickOutside);
	}, []);

	// Close on Escape
	useEffect(() => {
		function handleEscape(e: KeyboardEvent) {
			if (e.key === "Escape") setIsOpen(false);
		}
		document.addEventListener("keydown", handleEscape);
		return () => document.removeEventListener("keydown", handleEscape);
	}, []);

	const hasResults = results && (results.records.length > 0 || results.users.length > 0);
	const noResults = results && results.records.length === 0 && results.users.length === 0;

	return (
		<div ref={containerRef} className="relative w-full max-w-md">
			{/* Search input — pill shape */}
			<div className="flex items-center bg-surface-container-high/60 hover:bg-surface-container-high/80 rounded-full px-4 py-2 border border-outline-variant/10 focus-within:border-primary/40 focus-within:bg-surface-container-high transition-all duration-200">
				<span className="material-symbols-outlined text-[18px] text-on-surface-variant/60 mr-2.5 flex-shrink-0">
					search
				</span>
				<input
					type="search"
					value={query}
					onChange={handleChange}
					onFocus={() => results && setIsOpen(true)}
					placeholder="Search records, artists, diggers..."
					className="bg-transparent border-none outline-none font-mono text-xs text-on-surface placeholder:text-on-surface-variant/40 w-full"
					aria-label="Global search"
				/>
				{isPending && (
					<span className="material-symbols-outlined text-[16px] text-primary animate-spin ml-2 flex-shrink-0">
						progress_activity
					</span>
				)}
				{query && !isPending && (
					<button
						type="button"
						onClick={() => {
							setQuery("");
							setResults(null);
							setIsOpen(false);
						}}
						className="text-on-surface-variant/40 hover:text-on-surface-variant ml-2 flex-shrink-0"
					>
						<span className="material-symbols-outlined text-[16px]">close</span>
					</button>
				)}
			</div>

			{/* Dropdown results */}
			{isOpen && (hasResults || noResults) && (
				<div className="absolute top-full left-0 right-0 mt-2 bg-surface-container border border-outline-variant/15 rounded-xl shadow-2xl shadow-black/20 z-50 max-h-[420px] overflow-y-auto overflow-x-hidden">
					{noResults && (
						<div className="px-4 py-8 text-center">
							<span className="material-symbols-outlined text-2xl text-on-surface-variant/20 block mb-2">
								search_off
							</span>
							<span className="font-mono text-xs text-on-surface-variant">
								No results for &quot;{query}&quot;
							</span>
						</div>
					)}

					{/* Records section */}
					{results && results.records.length > 0 && (
						<div>
							<div className="px-4 pt-3 pb-1.5">
								<span className="font-mono text-[10px] text-on-surface-variant/60 uppercase tracking-widest">
									Records
								</span>
							</div>
							{results.records.map((record) => (
								<Link
									key={record.id}
									href={record.discogsId ? `/release/${record.discogsId}` : "#"}
									onClick={handleClose}
									className="flex items-center gap-3 px-4 py-2.5 hover:bg-surface-container-high/60 transition-colors"
								>
									{record.coverImageUrl ? (
										<Image
											src={record.coverImageUrl}
											alt=""
											width={36}
											height={36}
											unoptimized
											className="w-9 h-9 rounded object-cover flex-shrink-0"
										/>
									) : (
										<div className="w-9 h-9 rounded bg-surface-container-high flex items-center justify-center flex-shrink-0">
											<span className="material-symbols-outlined text-base text-on-surface-variant/30">
												album
											</span>
										</div>
									)}
									<div className="min-w-0 flex-1">
										<p className="font-mono text-xs text-on-surface truncate">{record.title}</p>
										<p className="font-mono text-[10px] text-on-surface-variant/60 truncate">
											{record.artist}
											{record.year ? ` · ${record.year}` : ""}
										</p>
									</div>
									<span className="material-symbols-outlined text-[14px] text-on-surface-variant/20 flex-shrink-0">
										arrow_forward
									</span>
								</Link>
							))}
						</div>
					)}

					{/* Divider */}
					{results && results.records.length > 0 && results.users.length > 0 && (
						<div className="mx-4 border-t border-outline-variant/10" />
					)}

					{/* Users section */}
					{results && results.users.length > 0 && (
						<div>
							<div className="px-4 pt-3 pb-1.5">
								<span className="font-mono text-[10px] text-on-surface-variant/60 uppercase tracking-widest">
									Diggers
								</span>
							</div>
							{results.users.map((user) => (
								<Link
									key={user.id}
									href={user.username ? `/perfil/${user.username}` : "#"}
									onClick={handleClose}
									className="flex items-center gap-3 px-4 py-2.5 hover:bg-surface-container-high/60 transition-colors"
								>
									{user.avatarUrl ? (
										<Image
											src={user.avatarUrl}
											alt=""
											width={32}
											height={32}
											unoptimized
											className="w-8 h-8 rounded-full object-cover flex-shrink-0"
										/>
									) : (
										<div className="w-8 h-8 rounded-full bg-surface-container-high flex items-center justify-center flex-shrink-0">
											<span className="font-mono text-[10px] font-bold text-primary">
												{(user.username?.[0] ?? "?").toUpperCase()}
											</span>
										</div>
									)}
									<div className="min-w-0 flex-1">
										<p className="font-mono text-xs text-on-surface truncate">
											{user.username ?? user.displayName ?? "Digger"}
										</p>
										{user.displayName && user.username && (
											<p className="font-mono text-[10px] text-on-surface-variant/60 truncate">
												{user.displayName}
											</p>
										)}
									</div>
									<span className="material-symbols-outlined text-[14px] text-on-surface-variant/20 flex-shrink-0">
										arrow_forward
									</span>
								</Link>
							))}
						</div>
					)}

					{/* Footer */}
					{hasResults && (
						<Link
							href="/explorar?tab=records"
							onClick={handleClose}
							className="flex items-center justify-center gap-1.5 px-4 py-3 font-mono text-xs text-primary hover:bg-surface-container-high/40 transition-colors border-t border-outline-variant/10"
						>
							<span className="material-symbols-outlined text-[14px]">search</span>
							Search all in Explore
						</Link>
					)}
				</div>
			)}
		</div>
	);
}
