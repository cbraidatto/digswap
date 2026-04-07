"use client";

import { useRef } from "react";

const SHOWCASE_ITEMS = [
	{
		id: "most-wanted",
		category: "WANTLIST",
		title: "Most Wanted Records",
		subtitle: "The records every digger hunts",
		accent: "#e8a427",
		icon: "favorite",
	},
	{
		id: "valuable-trades",
		category: "TRADES",
		title: "Notable Trades",
		subtitle: "Rare movements this week",
		accent: "#c0392b",
		icon: "swap_horiz",
	},
	{
		id: "rarest-now",
		category: "RARITY",
		title: "Rarest Right Now",
		subtitle: "Max score, minimum copies",
		accent: "#2980b9",
		icon: "diamond",
	},
	{
		id: "featured-diggers",
		category: "COMMUNITY",
		title: "Featured Diggers",
		subtitle: "Collections worth a follow",
		accent: "#27ae60",
		icon: "person_search",
	},
	{
		id: "new-arrivals",
		category: "DISCOVERY",
		title: "New Arrivals",
		subtitle: "Added in the last 7 days",
		accent: "#8e44ad",
		icon: "new_releases",
	},
];

// Duplicate for seamless infinite loop
const ITEMS = [...SHOWCASE_ITEMS, ...SHOWCASE_ITEMS];

export function FeedShowcase() {
	const scrollRef = useRef<HTMLDivElement>(null);
	const isDragging = useRef(false);
	const startX = useRef(0);
	const startScrollLeft = useRef(0);

	function onMouseDown(e: React.MouseEvent) {
		isDragging.current = true;
		startX.current = e.clientX;
		startScrollLeft.current = scrollRef.current?.scrollLeft ?? 0;
	}

	function onMouseMove(e: React.MouseEvent) {
		if (!isDragging.current || !scrollRef.current) return;
		const delta = e.clientX - startX.current;
		scrollRef.current.scrollLeft = startScrollLeft.current - delta;
		loopCorrect(scrollRef.current);
	}

	function onDragEnd() {
		isDragging.current = false;
	}

	function onTouchStart(e: React.TouchEvent) {
		isDragging.current = true;
		startX.current = e.touches[0].clientX;
		startScrollLeft.current = scrollRef.current?.scrollLeft ?? 0;
	}

	function onTouchMove(e: React.TouchEvent) {
		if (!isDragging.current || !scrollRef.current) return;
		const delta = e.touches[0].clientX - startX.current;
		scrollRef.current.scrollLeft = startScrollLeft.current - delta;
		loopCorrect(scrollRef.current);
	}

	function loopCorrect(el: HTMLDivElement) {
		const half = el.scrollWidth / 2;
		if (el.scrollLeft >= half) el.scrollLeft -= half;
		else if (el.scrollLeft < 0) el.scrollLeft += half;
	}

	return (
		<section className="mb-10 -mx-4 md:-mx-8">
			{/* Header */}
			<div className="px-4 md:px-8 mb-4 flex items-center justify-between">
				<span className="font-mono text-xs uppercase tracking-[0.2em] text-on-surface-variant">
					featured
				</span>
				<span className="font-mono text-xs text-outline">// feed showcase</span>
			</div>

			{/* Edge fade mask */}
			<div
				className="overflow-hidden"
				style={{
					maskImage:
						"linear-gradient(to right, transparent 0%, black 6%, black 94%, transparent 100%)",
					WebkitMaskImage:
						"linear-gradient(to right, transparent 0%, black 6%, black 94%, transparent 100%)",
				}}
			>
				{/* Draggable scroll container */}
				<div
					ref={scrollRef}
					className="overflow-x-auto scrollbar-none cursor-grab active:cursor-grabbing select-none"
					onMouseDown={onMouseDown}
					onMouseMove={onMouseMove}
					onMouseUp={onDragEnd}
					onMouseLeave={onDragEnd}
					onTouchStart={onTouchStart}
					onTouchMove={onTouchMove}
					onTouchEnd={onDragEnd}
				>
					<div className="flex gap-3 w-max px-4 md:px-8 pb-2">
						{ITEMS.map((item, i) => (
							<div
								// biome-ignore lint/suspicious/noArrayIndexKey: intentional duplicate for marquee loop
								key={`${item.id}-${i}`}
								className="relative flex-shrink-0 w-[220px] h-[300px] rounded overflow-hidden group bg-surface-container-high"
							>
								{/* Ghost Protocol placeholder — icon on dark surface */}
								<div className="absolute inset-0 flex items-center justify-center opacity-10">
									<span
										className="material-symbols-outlined text-on-surface"
										style={{ fontSize: "96px" }}
									>
										{item.icon}
									</span>
								</div>

								{/* Gradient overlay */}
								<div className="absolute inset-0 bg-gradient-to-t from-black via-black/55 to-black/10" />

								{/* Grain */}
								<div
									className="absolute inset-0 opacity-25 mix-blend-overlay pointer-events-none"
									style={{
										backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)'/%3E%3C/svg%3E")`,
									}}
								/>

								{/* Category badge */}
								<div className="absolute top-3 left-3">
									<span
										className="font-mono text-[9px] uppercase tracking-[0.2em] px-2 py-0.5 rounded-sm"
										style={{
											backgroundColor: `${item.accent}25`,
											color: item.accent,
											border: `1px solid ${item.accent}50`,
										}}
									>
										{item.category}
									</span>
								</div>

								{/* Title */}
								<div className="absolute bottom-0 left-0 right-0 p-4">
									<h3 className="font-heading text-white font-bold text-lg leading-tight mb-1">
										{item.title}
									</h3>
									<p className="font-mono text-white/45 text-xs leading-relaxed">{item.subtitle}</p>
								</div>
							</div>
						))}
					</div>
				</div>
			</div>
		</section>
	);
}
