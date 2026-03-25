const FEED_ITEMS = [
	{
		id: 1,
		user: "digger_0x7a",
		hash: "vnl-7f3k",
		timeAgo: "2 hours ago",
		statusLabel: "[RIP_SUCCESS]",
		statusColor: "text-primary bg-primary/10 border-primary/20",
		accentColor: "bg-primary",
		artist: "System_Echo",
		title: "Trans-Siberian_Data_Drift",
		genre: "Deep_Techno / Ambient",
		label: "Obsidian_Records [OBS-001]",
		stars: 128,
		forks: 14,
		comments: 8,
		coverBg: "bg-surface-container-high",
	},
	{
		id: 2,
		user: "neon_vortex",
		hash: "vnl-9p2q",
		timeAgo: "5 hours ago",
		statusLabel: "[TRADE_OFFER]",
		statusColor: "text-secondary bg-secondary/10 border-secondary/20",
		accentColor: "bg-secondary",
		artist: "Circuit_Breaker",
		title: "Digital_Residue_Vol_4",
		genre: "Electro / EBM",
		label: "Neon_Archives [NEO-042]",
		stars: 45,
		forks: 7,
		comments: 3,
		coverBg: "bg-surface-container-high",
	},
	{
		id: 3,
		user: "vinyl_ghost",
		hash: "vnl-2m8r",
		timeAgo: "yesterday",
		statusLabel: "[NEW_COMMIT]",
		statusColor: "text-tertiary bg-tertiary/10 border-tertiary/20",
		accentColor: "bg-tertiary",
		artist: "Phantom_Records",
		title: "Subterranean_Frequencies",
		genre: "Industrial / Noise",
		label: "Dark_Matter [DM-007]",
		stars: 92,
		forks: 21,
		comments: 15,
		coverBg: "bg-surface-container-high",
	},
];

const TRENDING = [
	{ name: "Rare_Grooves_Japan", founders: "city_pop_king, tokyo_dig", stars: "2.4k", forks: "412", color: "border-primary" },
	{ name: "Industrial_Noise_90s", founders: "static_fuzz, wire_head", stars: "1.8k", forks: "289", color: "border-secondary" },
];

const SYSTEM_LOGS = [
	{ time: "21:04:22", level: "SYNC", levelColor: "text-primary", msg: "complete for sector 4G." },
	{ time: "21:05:01", level: "WARN", levelColor: "text-tertiary", msg: "New fork detected in Jazz_Diggers." },
	{ time: "21:05:45", level: "INFO", levelColor: "text-secondary", msg: "Peer 0x9f joined the swarm." },
];

export default function FeedPage() {
	return (
		<div className="flex min-h-[calc(100vh-56px)]">
			{/* Main Feed */}
			<main className="flex-1 p-4 md:p-8 max-w-4xl mx-auto w-full">
				<header className="mb-8">
					<h1 className="font-heading text-3xl font-extrabold text-on-surface mb-2 uppercase tracking-tight">
						ARCHIVE_FEED
					</h1>
					<p className="text-on-surface-variant font-sans text-sm">
						Latest data commits from the global vinyl network.
					</p>
				</header>

				<section className="space-y-6">
					{FEED_ITEMS.map((item) => (
						<article
							key={item.id}
							className="bg-surface-container-low rounded-xl overflow-hidden shadow-2xl transition-all duration-300 hover:bg-surface-container"
						>
							{/* Color accent strip */}
							<div className="h-1 w-full bg-surface-container-high flex">
								<div className={`h-full w-1/3 ${item.accentColor}`} />
							</div>

							<div className="p-4 md:p-6">
								{/* Header row */}
								<div className="flex justify-between items-start mb-4">
									<div className="flex items-center gap-3">
										<div className="w-10 h-10 rounded border border-primary/20 bg-surface-container-high flex items-center justify-center">
											<span className="material-symbols-outlined text-primary text-sm">
												album
											</span>
										</div>
										<div>
											<div className="flex items-center gap-2">
												<span className="font-mono text-sm font-bold text-primary">
													{item.user}
												</span>
												<span className="text-[10px] font-mono text-outline bg-outline-variant/10 px-1.5 py-0.5 rounded">
													{item.hash}
												</span>
											</div>
											<div className="text-[10px] font-mono text-on-surface-variant uppercase">
												committed {item.timeAgo}
											</div>
										</div>
									</div>
									<span
										className={`font-mono text-[10px] px-2 py-0.5 rounded border ${item.statusColor}`}
									>
										{item.statusLabel}
									</span>
								</div>

								{/* Content grid */}
								<div className="grid grid-cols-1 md:grid-cols-12 gap-6">
									{/* Cover art */}
									<div
										className={`md:col-span-4 aspect-square ${item.coverBg} rounded overflow-hidden relative flex items-center justify-center`}
									>
										<span className="material-symbols-outlined text-on-surface-variant/30 text-6xl">
											album
										</span>
									</div>

									{/* Metadata */}
									<div className="md:col-span-8 flex flex-col justify-center">
										<div className="space-y-2 mb-6">
											<div className="font-mono text-xs flex gap-2">
												<span className="text-tertiary">ARTIST</span>
												<span className="text-on-surface">=&gt;</span>
												<span className="text-secondary">{item.artist}</span>
											</div>
											<div className="font-mono text-xs flex gap-2">
												<span className="text-tertiary">TITLE</span>
												<span className="text-on-surface">=&gt;</span>
												<span className="text-primary-fixed">&quot;{item.title}&quot;</span>
											</div>
											<div className="font-mono text-xs flex gap-2">
												<span className="text-tertiary">GENRE</span>
												<span className="text-on-surface">=&gt;</span>
												<span className="text-on-surface-variant">{item.genre}</span>
											</div>
											<div className="font-mono text-xs flex gap-2">
												<span className="text-tertiary">LABEL</span>
												<span className="text-on-surface">=&gt;</span>
												<span className="text-outline">{item.label}</span>
											</div>
										</div>

										<div className="flex flex-wrap gap-3">
											<button
												type="button"
												className="flex items-center gap-2 px-3 py-1.5 bg-surface-container-high rounded border border-outline-variant/20 hover:border-primary/50 transition-all text-xs font-mono group"
											>
												<span className="material-symbols-outlined text-sm group-hover:text-primary">
													star
												</span>
												Star{" "}
												<span className="text-primary ml-1">{item.stars}</span>
											</button>
											<button
												type="button"
												className="flex items-center gap-2 px-3 py-1.5 bg-surface-container-high rounded border border-outline-variant/20 hover:border-secondary/50 transition-all text-xs font-mono group"
											>
												<span className="material-symbols-outlined text-sm group-hover:text-secondary">
													fork_left
												</span>
												Fork{" "}
												<span className="text-secondary ml-1">{item.forks}</span>
											</button>
											<button
												type="button"
												className="flex items-center gap-2 px-3 py-1.5 bg-surface-container-high rounded border border-outline-variant/20 hover:border-tertiary/50 transition-all text-xs font-mono group"
											>
												<span className="material-symbols-outlined text-sm group-hover:text-tertiary">
													chat_bubble
												</span>
												Comment{" "}
												<span className="text-tertiary ml-1">{item.comments}</span>
											</button>
										</div>
									</div>
								</div>
							</div>
						</article>
					))}
				</section>
			</main>

			{/* Right Sidebar */}
			<aside className="fixed right-0 top-14 h-[calc(100vh-56px)] w-80 bg-surface-container-low border-l border-outline-variant/10 p-6 hidden 2xl:block overflow-y-auto">
				<section className="mb-8">
					<h3 className="font-mono text-xs font-bold text-primary mb-4 flex items-center gap-2 uppercase tracking-widest">
						<span className="material-symbols-outlined text-sm">trending_up</span>
						Trending_Repos
					</h3>
					<div className="space-y-4">
						{TRENDING.map((repo) => (
							<div
								key={repo.name}
								className={`p-3 bg-surface-container-high rounded border-l-2 ${repo.color}`}
							>
								<div className="text-xs font-mono text-on-surface font-bold">
									{repo.name}
								</div>
								<div className="text-[10px] font-mono text-on-surface-variant mt-1">
									Founders: {repo.founders}
								</div>
								<div className="mt-2 flex items-center gap-4">
									<span className="text-[10px] font-mono text-primary flex items-center gap-1">
										<span className="material-symbols-outlined text-[10px]">star</span>
										{repo.stars}
									</span>
									<span className="text-[10px] font-mono text-secondary flex items-center gap-1">
										<span className="material-symbols-outlined text-[10px]">fork_left</span>
										{repo.forks}
									</span>
								</div>
							</div>
						))}
					</div>
				</section>

				<section>
					<h3 className="font-mono text-xs font-bold text-primary mb-4 flex items-center gap-2 uppercase tracking-widest">
						<span className="material-symbols-outlined text-sm">terminal</span>
						System_Logs
					</h3>
					<div className="bg-surface-container-lowest p-3 rounded font-mono text-[10px] text-outline leading-relaxed border border-outline-variant/10">
						{SYSTEM_LOGS.map((log) => (
							<div key={log.time}>
								[{log.time}]{" "}
								<span className={log.levelColor}>{log.level}</span> {log.msg}
							</div>
						))}
						<div className="mt-2 text-primary blink">&gt; Initializing connection...</div>
					</div>
				</section>
			</aside>
		</div>
	);
}
