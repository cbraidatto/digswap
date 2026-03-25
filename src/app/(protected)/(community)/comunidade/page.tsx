const OPEN_SWAPS = [
	{
		id: 942,
		title: "Mint Condition 1994 IDM Selection",
		openedAgo: "3 hours ago",
		by: "bit_archeologist",
		comments: 12,
		tags: [
			{ label: "[SECURE]", color: "text-primary border-primary" },
			{ label: "[P2P]", color: "text-secondary border-secondary" },
		],
	},
	{
		id: 941,
		title: "Japanese Pressings: City Pop Core Box",
		openedAgo: "5 hours ago",
		by: "neon_wax",
		comments: 5,
		tags: [
			{ label: "[HIGH FIDELITY]", color: "text-tertiary border-tertiary" },
			{ label: "[P2P]", color: "text-secondary border-secondary" },
		],
	},
	{
		id: 938,
		title: "Dubstep Archive (2005-2010) - Limited White Labels",
		openedAgo: "yesterday",
		by: "low_freq_miner",
		comments: 28,
		tags: [{ label: "[SECURE]", color: "text-primary border-primary" }],
	},
];

const GENRE_CREWS = [
	{
		name: "Breakcore_Front",
		desc: "Dedicated to high-speed breaks and digital glitch archaeology.",
		members: "2.4k",
		status: "[ACTIVE_BURST]",
		statusColor: "text-primary",
		icon: "speed",
		iconBg: "bg-tertiary-container/20 text-tertiary",
	},
	{
		name: "Ambient_Voids",
		desc: "Submerged soundscapes and field recordings from the deep web.",
		members: "1.8k",
		status: "[QUIET_SYNC]",
		statusColor: "text-secondary",
		icon: "waves",
		iconBg: "bg-secondary-container/20 text-secondary",
	},
	{
		name: "Acid_Labs",
		desc: "303 sequences and silver-box worship. Pure analog signals.",
		members: "4.1k",
		status: "[OSCILLATING]",
		statusColor: "text-tertiary",
		icon: "graphic_eq",
		iconBg: "bg-primary-container/20 text-primary",
	},
];

const TOP_DIGGERS = [
	{ rank: "01", name: "syntax_error", xp: "12,450" },
	{ rank: "02", name: "null_pointer", xp: "11,820" },
	{ rank: "03", name: "void_walker", xp: "10,910" },
];

export default function ComunidadePage() {
	return (
		<div className="max-w-7xl mx-auto px-4 md:px-8 py-8 grid grid-cols-1 xl:grid-cols-12 gap-8">
			{/* Left Column */}
			<div className="xl:col-span-8 space-y-10">
				{/* Header */}
				<div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
					<div>
						<span className="text-[10px] font-mono text-primary tracking-[0.2em] uppercase">
							Communication_Node
						</span>
						<h1 className="text-4xl font-bold font-heading text-on-surface mt-1">
							Community Hub
						</h1>
					</div>
					<div className="flex items-center gap-2 bg-surface-container-low p-1 rounded-lg">
						<button
							type="button"
							className="px-4 py-1.5 bg-primary text-on-primary text-xs font-bold rounded shadow-sm"
						>
							Swaps
						</button>
						<button
							type="button"
							className="px-4 py-1.5 text-on-surface-variant hover:text-on-surface text-xs font-bold transition-colors"
						>
							Discussions
						</button>
						<button
							type="button"
							className="px-4 py-1.5 text-on-surface-variant hover:text-on-surface text-xs font-bold transition-colors"
						>
							Crews
						</button>
					</div>
				</div>

				{/* Active Swaps (PR Style) */}
				<section className="bg-surface-container-low rounded-xl overflow-hidden shadow-2xl shadow-black/40">
					<div className="bg-surface-container-high px-6 py-4 flex items-center justify-between border-b border-outline-variant/10">
						<div className="flex items-center gap-6">
							<div className="flex items-center gap-2 text-primary">
								<span className="material-symbols-outlined text-[18px]">alt_route</span>
								<span className="text-xs font-bold font-mono">
									{OPEN_SWAPS.length} Open Swaps
								</span>
							</div>
							<div className="flex items-center gap-2 text-on-surface-variant">
								<span className="material-symbols-outlined text-[18px]">check_circle</span>
								<span className="text-xs font-medium font-mono">1,204 Completed</span>
							</div>
						</div>
						<div className="hidden md:flex items-center gap-4 text-xs font-medium text-on-surface-variant">
							<span>Label</span>
							<span>Sort</span>
						</div>
					</div>

					<div className="divide-y divide-outline-variant/10">
						{OPEN_SWAPS.map((swap) => (
							<div
								key={swap.id}
								className="px-6 py-4 hover:bg-surface-container-high/40 transition-colors group"
							>
								<div className="flex gap-4">
									<span className="material-symbols-outlined text-primary mt-1 text-[20px]">
										call_merge
									</span>
									<div className="flex-1">
										<div className="flex flex-wrap items-center gap-2 mb-1">
											<a
												href="#"
												className="text-on-surface font-semibold hover:text-primary transition-colors font-heading"
											>
												{swap.title}
											</a>
											{swap.tags.map((tag) => (
												<span
													key={tag.label}
													className={`px-2 py-0.5 rounded text-[10px] font-mono border ${tag.color}`}
												>
													{tag.label}
												</span>
											))}
										</div>
										<div className="flex items-center gap-3 text-[11px] text-on-surface-variant font-mono">
											<span>
												#{swap.id} opened {swap.openedAgo} by{" "}
												<span className="text-on-surface underline cursor-pointer">
													{swap.by}
												</span>
											</span>
											<span className="flex items-center gap-1">
												<span className="material-symbols-outlined text-[14px]">
													chat_bubble
												</span>
												{swap.comments}
											</span>
										</div>
									</div>
								</div>
							</div>
						))}
					</div>
				</section>

				{/* Genre Crews */}
				<section>
					<div className="flex items-center justify-between mb-6">
						<h3 className="text-xl font-bold font-heading text-on-surface">Genre Crews</h3>
						<a href="#" className="text-xs font-mono text-primary hover:underline">
							VIEW_ALL_CREWS
						</a>
					</div>
					<div className="grid grid-cols-1 md:grid-cols-3 gap-4">
						{GENRE_CREWS.map((crew) => (
							<div
								key={crew.name}
								className="bg-surface-container-low p-6 rounded-xl border border-outline-variant/10 hover:border-primary/30 transition-all cursor-pointer group"
							>
								<div className="flex items-start justify-between mb-4">
									<div
										className={`w-12 h-12 rounded ${crew.iconBg} flex items-center justify-center`}
									>
										<span className="material-symbols-outlined text-[28px]">{crew.icon}</span>
									</div>
									<span className="text-[10px] font-mono text-on-surface-variant">
										{crew.members} Members
									</span>
								</div>
								<h4 className="text-lg font-bold font-heading mb-2 group-hover:text-primary transition-colors">
									{crew.name}
								</h4>
								<p className="text-sm text-on-surface-variant leading-relaxed mb-4">
									{crew.desc}
								</p>
								<div className="pt-4 border-t border-outline-variant/10 flex items-center justify-between">
									<span className={`text-[10px] font-mono ${crew.statusColor}`}>
										{crew.status}
									</span>
									<span className="material-symbols-outlined text-on-surface-variant text-[18px]">
										trending_up
									</span>
								</div>
							</div>
						))}
					</div>
				</section>
			</div>

			{/* Right Column */}
			<div className="xl:col-span-4 space-y-8">
				{/* System Alerts */}
				<section className="bg-surface-container-low rounded-xl p-6 border-l-4 border-secondary shadow-lg">
					<div className="flex items-center gap-2 mb-6 text-secondary">
						<span className="material-symbols-outlined text-[20px]">podium</span>
						<h3 className="text-sm font-bold uppercase tracking-widest font-mono">
							System_Alerts
						</h3>
					</div>
					<div className="space-y-4">
						{[
							{
								icon: "event",
								iconBg: "bg-secondary/10 text-secondary",
								title: "Tokyo Vinyl Fair 2024",
								desc: "Global P2P nodes connecting in 48h. Prepare data logs.",
							},
							{
								icon: "warning",
								iconBg: "bg-error/10 text-error",
								title: "Critical Update: Protocol 7",
								desc: "Metadata integrity check required for all Tier-3 swaps.",
							},
						].map((alert) => (
							<div
								key={alert.title}
								className="flex gap-4 p-3 bg-surface-container-high rounded-lg cursor-pointer hover:bg-surface-bright transition-colors"
							>
								<div
									className={`flex-shrink-0 w-10 h-10 ${alert.iconBg} flex items-center justify-center rounded`}
								>
									<span className="material-symbols-outlined">{alert.icon}</span>
								</div>
								<div>
									<h4 className="text-xs font-bold text-on-surface mb-1">{alert.title}</h4>
									<p className="text-[10px] text-on-surface-variant">{alert.desc}</p>
								</div>
							</div>
						))}
					</div>
				</section>

				{/* Top Diggers */}
				<section className="bg-surface-container-low rounded-xl overflow-hidden shadow-lg border border-outline-variant/5">
					<div className="bg-surface-container-high px-6 py-4 flex items-center justify-between">
						<h3 className="text-xs font-bold uppercase tracking-widest font-mono text-primary">
							Top_Diggers
						</h3>
						<span className="text-[10px] font-mono text-on-surface-variant">Global_Rank</span>
					</div>
					<div className="p-2">
						<div className="space-y-1">
							{TOP_DIGGERS.map((digger) => (
								<div
									key={digger.rank}
									className="flex items-center justify-between p-3 rounded-lg hover:bg-surface-container-high transition-colors cursor-pointer group"
								>
									<div className="flex items-center gap-3">
										<span className="text-xs font-mono text-on-surface-variant w-4">
											{digger.rank}
										</span>
										<div className="w-8 h-8 rounded bg-primary-container/30 flex items-center justify-center border border-primary/20">
											<span className="material-symbols-outlined text-primary text-sm">
												person
											</span>
										</div>
										<span className="text-sm font-medium text-on-surface group-hover:text-primary">
											{digger.name}
										</span>
									</div>
									<span className="text-xs font-mono text-primary">{digger.xp} XP</span>
								</div>
							))}
						</div>
						<button
							type="button"
							className="w-full mt-4 py-2 text-[10px] font-mono text-on-surface-variant hover:text-primary transition-colors border-t border-outline-variant/10 uppercase tracking-widest"
						>
							Load_More_Entities
						</button>
					</div>
				</section>

				{/* Stats bento */}
				<div className="grid grid-cols-2 gap-4">
					{[
						{ label: "Nodes_Online", value: "4,812", color: "text-primary", bars: ["w-full bg-primary", "w-1/2 bg-primary/40", "w-1/4 bg-primary/10"] },
						{ label: "Data_Flow", value: "82GB/s", color: "text-secondary", bars: ["w-full bg-secondary", "w-3/4 bg-secondary/40", "w-1/3 bg-secondary/10"] },
					].map((stat) => (
						<div
							key={stat.label}
							className="bg-surface-container-low p-4 rounded-xl border border-outline-variant/10"
						>
							<span className="text-[10px] font-mono text-on-surface-variant block mb-2 uppercase">
								{stat.label}
							</span>
							<div className={`text-2xl font-bold font-heading ${stat.color}`}>{stat.value}</div>
							<div className="mt-2 flex gap-0.5">
								{stat.bars.map((bar) => (
									<div key={bar} className={`h-1 ${bar}`} />
								))}
							</div>
						</div>
					))}
				</div>
			</div>
		</div>
	);
}
