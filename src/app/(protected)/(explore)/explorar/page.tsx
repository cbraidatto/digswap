const DIRECTORIES = [
	{ path: "/root/bpm", active: true },
	{ path: "/root/genre/jazz", active: false },
	{ path: "/root/genre/techno", active: false },
	{ path: "/root/decade/80s", active: false },
	{ path: "/root/decade/90s", active: false },
	{ path: "/root/region/japan", active: false },
];

const SEARCH_RESULTS = [
	{
		id: 1,
		title: "Trans-Siberian_Data_Drift",
		artist: "System_Echo",
		label: "Obsidian Records",
		year: 1994,
		format: "LP",
		rarity: "[ULTRA_RARE]",
		rarityColor: "text-tertiary border-tertiary",
		owners: 3,
	},
	{
		id: 2,
		title: "Digital_Residue_Vol_4",
		artist: "Circuit_Breaker",
		label: "Neon Archives",
		year: 2001,
		format: '12"',
		rarity: "[RARE]",
		rarityColor: "text-secondary border-secondary",
		owners: 12,
	},
	{
		id: 3,
		title: "Subterranean_Frequencies",
		artist: "Phantom_Records",
		label: "Dark Matter",
		year: 1997,
		format: "LP",
		rarity: "[COMMON]",
		rarityColor: "text-on-surface-variant border-outline-variant",
		owners: 47,
	},
	{
		id: 4,
		title: "Fluorescent_Black",
		artist: "Null_Pointer",
		label: "Void Records",
		year: 2003,
		format: "2xLP",
		rarity: "[RARE]",
		rarityColor: "text-secondary border-secondary",
		owners: 8,
	},
];

export default function ExplorarPage() {
	return (
		<div className="min-h-[calc(100vh-56px)] flex flex-col">
			{/* Search Hero */}
			<section className="w-full bg-surface-container-low p-8 md:p-12">
				<div className="max-w-4xl mx-auto">
					<div className="mb-4 flex items-center gap-2 text-primary font-mono text-xs">
						<span className="material-symbols-outlined text-sm">terminal</span>
						<span>DIGGER_V4.2.0_STABLE</span>
					</div>
					<div className="relative group">
						<div className="absolute inset-0 bg-primary/5 blur-xl group-focus-within:bg-primary/10 transition-all rounded" />
						<div className="relative flex items-center bg-surface-container-lowest p-4 md:p-6 border-l-4 border-primary shadow-2xl">
							<span className="text-primary font-mono text-xl md:text-2xl mr-4">&gt;</span>
							<input
								type="text"
								className="w-full bg-transparent border-none focus:ring-0 text-on-surface font-mono text-lg md:text-xl placeholder:text-on-surface-variant/40 outline-none"
								placeholder="Search or jump to vinyl, artist, label..."
							/>
							<span className="w-3 h-8 bg-primary blink ml-2" />
						</div>
					</div>
					<div className="mt-4 flex flex-wrap gap-4 font-mono text-[10px] text-on-surface-variant">
						<span className="flex items-center gap-1">
							<kbd className="bg-surface-container-high px-1 rounded border border-outline-variant/30">
								CTRL
							</kbd>
							+{" "}
							<kbd className="bg-surface-container-high px-1 rounded border border-outline-variant/30">
								K
							</kbd>{" "}
							to focus
						</span>
						<span className="flex items-center gap-1">
							<kbd className="bg-surface-container-high px-1 rounded border border-outline-variant/30">
								ESC
							</kbd>{" "}
							to clear
						</span>
						<span className="text-primary/60 ml-auto">ESTIMATED RESULTS: 1.4M OBJECTS</span>
					</div>
				</div>
			</section>

			{/* Discovery Grid */}
			<section className="flex-1 flex flex-col md:flex-row">
				{/* Filters */}
				<aside className="w-full md:w-64 bg-surface-container-low/50 border-r border-outline-variant/10 p-6 space-y-8 order-2 md:order-1">
					<div>
						<h4 className="text-[10px] font-mono uppercase tracking-[0.2em] text-outline mb-4">
							Directories
						</h4>
						<ul className="space-y-2 font-mono text-xs">
							{DIRECTORIES.map((dir) => (
								<li key={dir.path}>
									<button
										type="button"
										className={`flex items-center gap-2 w-full p-2 rounded text-left transition-colors ${
											dir.active
												? "text-primary hover:bg-surface-container-high"
												: "text-on-surface-variant hover:text-on-surface hover:bg-surface-container-high"
										}`}
									>
										<span className="material-symbols-outlined text-sm">
											{dir.active ? "folder_open" : "folder"}
										</span>
										{dir.path}
									</button>
								</li>
							))}
						</ul>
					</div>

					<div>
						<h4 className="text-[10px] font-mono uppercase tracking-[0.2em] text-outline mb-4">
							Format
						</h4>
						<div className="space-y-2 font-mono text-xs">
							{["All", "LP", '12"', '7"', "CD", "Cassette"].map((fmt) => (
								<label key={fmt} className="flex items-center gap-2 cursor-pointer">
									<input type="checkbox" className="accent-primary" defaultChecked={fmt === "All"} />
									<span className="text-on-surface-variant hover:text-on-surface">{fmt}</span>
								</label>
							))}
						</div>
					</div>

					<div>
						<h4 className="text-[10px] font-mono uppercase tracking-[0.2em] text-outline mb-4">
							Rarity
						</h4>
						<div className="space-y-2 font-mono text-xs">
							{[
								{ label: "[ULTRA_RARE]", color: "text-tertiary" },
								{ label: "[RARE]", color: "text-secondary" },
								{ label: "[COMMON]", color: "text-on-surface-variant" },
							].map((r) => (
								<label key={r.label} className="flex items-center gap-2 cursor-pointer">
									<input type="checkbox" className="accent-primary" />
									<span className={r.color}>{r.label}</span>
								</label>
							))}
						</div>
					</div>
				</aside>

				{/* Results */}
				<main className="flex-1 p-6 order-1 md:order-2">
					<div className="flex items-center justify-between mb-6">
						<div className="font-mono text-xs text-on-surface-variant">
							<span className="text-primary">{SEARCH_RESULTS.length}</span> results found
						</div>
						<div className="flex items-center gap-2 text-xs font-mono text-on-surface-variant">
							<span>Sort:</span>
							<button type="button" className="text-primary hover:underline">
								Rarity_DESC
							</button>
						</div>
					</div>

					<div className="space-y-3">
						{SEARCH_RESULTS.map((result) => (
							<div
								key={result.id}
								className="bg-surface-container-low rounded-lg p-4 flex gap-4 hover:bg-surface-container transition-colors cursor-pointer group"
							>
								<div className="w-12 h-12 bg-surface-container-high rounded flex-shrink-0 flex items-center justify-center">
									<span className="material-symbols-outlined text-on-surface-variant/40 text-xl">
										album
									</span>
								</div>
								<div className="flex-1 min-w-0">
									<div className="flex flex-wrap items-center gap-2 mb-1">
										<span className="font-heading font-semibold text-on-surface group-hover:text-primary transition-colors truncate">
											{result.title}
										</span>
										<span
											className={`text-[10px] font-mono px-1.5 py-0.5 rounded border ${result.rarityColor}`}
										>
											{result.rarity}
										</span>
									</div>
									<div className="flex flex-wrap items-center gap-3 text-[11px] text-on-surface-variant font-mono">
										<span>{result.artist}</span>
										<span>·</span>
										<span>{result.label}</span>
										<span>·</span>
										<span>{result.year}</span>
										<span>·</span>
										<span>{result.format}</span>
									</div>
								</div>
								<div className="flex flex-col items-end gap-1 flex-shrink-0">
									<span className="text-[10px] font-mono text-on-surface-variant">
										{result.owners} owners
									</span>
									<button type="button" className="text-[10px] font-mono text-primary hover:underline">
										VIEW_OWNERS
									</button>
								</div>
							</div>
						))}
					</div>
				</main>
			</section>
		</div>
	);
}
