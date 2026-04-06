"use client";

import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import Image from "next/image";
import Link from "next/link";
import { globalSearchAction, type GlobalSearchResult } from "@/actions/search";

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

	const hasResults = results && (results.records.length > 0 || results.users.length > 0);
	const noResults = results && results.records.length === 0 && results.users.length === 0;

	return (
		<div ref={containerRef} className="relative hidden md:block">
			<div className="flex items-center bg-surface-container-high/50 rounded px-3 py-1.5 border border-outline-variant/20 focus-within:border-primary/50 transition-colors">
				<span className="material-symbols-outlined text-sm text-on-surface-variant mr-2">search</span>
				<input
					type="text"
					value={query}
					onChange={handleChange}
					onFocus={() => results && setIsOpen(true)}
					placeholder="Search records, artists, diggers..."
					className="bg-transparent border-none outline-none font-mono text-xs text-on-surface placeholder:text-on-surface-variant/40 w-48 lg:w-64"
					role="searchbox"
					aria-label="Global search"
				/>
				{isPending && (
					<span className="material-symbols-outlined text-sm text-on-surface-variant animate-spin">progress_activity</span>
				)}
			</div>

			{/* Dropdown */}
			{isOpen && (hasResults || noResults) && (
				<div className="absolute top-full left-0 right-0 mt-1 bg-surface-container-low border border-outline-variant/20 rounded shadow-lg z-50 max-h-96 overflow-y-auto">
					{noResults && (
						<div className="px-4 py-6 text-center">
							<span className="font-mono text-xs text-on-surface-variant">
								No results for &quot;{query}&quot;
							</span>
						</div>
					)}

					{/* Records */}
					{results && results.records.length > 0 && (
						<div>
							<div className="px-3 py-2 border-b border-outline-variant/10">
								<span className="font-mono text-[10px] text-on-surface-variant uppercase tracking-widest">
									Records
								</span>
							</div>
							{results.records.map((record) => (
								<Link
									key={record.id}
									href={record.discogsId ? `/release/${record.discogsId}` : "#"}
									onClick={handleClose}
									className="flex items-center gap-3 px-3 py-2 hover:bg-surface-container-high transition-colors"
								>
									{record.coverImageUrl ? (
										<Image
											src={record.coverImageUrl}
											alt=""
											width={32}
											height={32}
											unoptimized
											className="w-8 h-8 rounded flex-shrink-0 object-cover"
										/>
									) : (
										<div className="w-8 h-8 rounded bg-surface-container-high flex items-center justify-center flex-shrink-0">
											<span className="material-symbols-outlined text-sm text-on-surface-variant/30">album</span>
										</div>
									)}
									<div className="min-w-0 flex-1">
										<p className="font-mono text-xs text-on-surface truncate">{record.title}</p>
										<p className="font-mono text-[10px] text-on-surface-variant truncate">
											{record.artist}{record.year ? ` · ${record.year}` : ""}
										</p>
									</div>
								</Link>
							))}
						</div>
					)}

					{/* Users */}
					{results && results.users.length > 0 && (
						<div>
							<div className="px-3 py-2 border-b border-outline-variant/10">
								<span className="font-mono text-[10px] text-on-surface-variant uppercase tracking-widest">
									Diggers
								</span>
							</div>
							{results.users.map((user) => (
								<Link
									key={user.id}
									href={user.username ? `/perfil/${user.username}` : "#"}
									onClick={handleClose}
									className="flex items-center gap-3 px-3 py-2 hover:bg-surface-container-high transition-colors"
								>
									{user.avatarUrl ? (
										<Image
											src={user.avatarUrl}
											alt=""
											width={28}
											height={28}
											unoptimized
											className="w-7 h-7 rounded-full flex-shrink-0 object-cover"
										/>
									) : (
										<div className="w-7 h-7 rounded-full bg-surface-container-high flex items-center justify-center flex-shrink-0">
											<span className="font-mono text-[10px] font-bold text-primary">
												{(user.username?.[0] ?? "?").toUpperCase()}
											</span>
										</div>
									)}
									<div className="min-w-0">
										<p className="font-mono text-xs text-on-surface truncate">
											{user.username ?? user.displayName ?? "Digger"}
										</p>
										{user.displayName && user.username && (
											<p className="font-mono text-[10px] text-on-surface-variant truncate">{user.displayName}</p>
										)}
									</div>
								</Link>
							))}
						</div>
					)}

					{/* View all link */}
					{hasResults && (
						<Link
							href={`/explorar?tab=records`}
							onClick={handleClose}
							className="block px-3 py-2.5 text-center font-mono text-xs text-primary hover:bg-surface-container-high transition-colors border-t border-outline-variant/10"
						>
							View all in Explore →
						</Link>
					)}
				</div>
			)}
		</div>
	);
}
