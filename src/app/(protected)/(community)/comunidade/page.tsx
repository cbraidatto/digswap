export default function ComunidadePage() {
	return (
		<div className="max-w-4xl mx-auto px-4 md:px-8 py-8 space-y-10">
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

			{/* Swaps empty state */}
			<section className="bg-surface-container-low rounded-xl p-10 flex flex-col items-center justify-center text-center border border-outline-variant/10">
				<span className="material-symbols-outlined text-secondary text-5xl mb-6 opacity-60">
					sync_alt
				</span>
				<div className="font-mono text-sm text-secondary mb-2">
					&gt; swaps_queue: empty
				</div>
				<div className="font-mono text-xs text-on-surface-variant mb-4 max-w-sm leading-relaxed">
					p2p audio trades between diggers.
					<br />
					share rips of your vinyl directly — no server, no middleman.
				</div>
				<div className="font-mono text-[10px] text-outline border border-outline-variant/20 px-4 py-2 rounded">
					[PHASE_9: P2P_TRADING]
				</div>
			</section>

			{/* Discussions empty state */}
			<section className="bg-surface-container-low rounded-xl p-10 flex flex-col items-center justify-center text-center border border-outline-variant/10">
				<span className="material-symbols-outlined text-tertiary text-5xl mb-6 opacity-60">
					forum
				</span>
				<div className="font-mono text-sm text-tertiary mb-2">
					&gt; discussions: no threads
				</div>
				<div className="font-mono text-xs text-on-surface-variant mb-4 max-w-sm leading-relaxed">
					group discussions, digs, and deep cuts.
					<br />
					the conversation starts once the social layer is live.
				</div>
				<div className="font-mono text-[10px] text-outline border border-outline-variant/20 px-4 py-2 rounded">
					[PHASE_5: SOCIAL_LAYER]
				</div>
			</section>

			{/* Crews empty state */}
			<section className="bg-surface-container-low rounded-xl p-10 flex flex-col items-center justify-center text-center border border-outline-variant/10">
				<span className="material-symbols-outlined text-primary text-5xl mb-6 opacity-60">
					groups
				</span>
				<div className="font-mono text-sm text-primary mb-2">
					&gt; crews: no groups yet
				</div>
				<div className="font-mono text-xs text-on-surface-variant mb-4 max-w-sm leading-relaxed">
					genre crews, era groups, niche collectives.
					<br />
					auto-generated groups form around shared taste — and you can create your own.
				</div>
				<div className="font-mono text-[10px] text-outline border border-outline-variant/20 px-4 py-2 rounded">
					[PHASE_7: COMMUNITY]
				</div>
			</section>
		</div>
	);
}
