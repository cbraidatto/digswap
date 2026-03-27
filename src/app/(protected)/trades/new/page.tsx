export default function NewTradePage() {
	return (
		<div className="max-w-4xl mx-auto px-4 md:px-8 py-8">
			<div className="mb-8">
				<span className="text-[10px] font-mono text-primary tracking-[0.2em] uppercase">
					Protocol / Trade
				</span>
				<h1 className="text-3xl font-bold font-heading text-on-surface mt-1 uppercase">
					INITIALIZE_TRADE
				</h1>
				<p className="text-on-surface-variant font-mono text-xs mt-2">
					Propose a P2P audio file exchange. Both parties must be online to complete the transfer.
				</p>
			</div>

			{/* Trade form shell */}
			<div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
				{/* My offer */}
				<div className="bg-surface-container-low rounded-xl p-6 border border-outline-variant/10">
					<h2 className="text-xs font-mono uppercase tracking-widest text-on-surface-variant mb-4">
						Your_Offer
					</h2>
					<div className="bg-surface-container-lowest rounded-lg p-8 flex flex-col items-center justify-center gap-3 border-2 border-dashed border-outline-variant/30 cursor-pointer hover:border-primary/30 transition-colors">
						<span className="material-symbols-outlined text-on-surface-variant/40 text-4xl">
							add_circle
						</span>
						<span className="text-xs font-mono text-on-surface-variant">
							SELECT_RECORD_FROM_COLLECTION
						</span>
					</div>
				</div>

				{/* Their collection */}
				<div className="bg-surface-container-low rounded-xl p-6 border border-outline-variant/10">
					<h2 className="text-xs font-mono uppercase tracking-widest text-on-surface-variant mb-4">
						Request_From
					</h2>
					<div className="bg-surface-container-lowest rounded-lg p-4 border-l-4 border-primary/20">
						<div className="text-xs font-mono text-on-surface-variant">
							TARGET_USER: <span className="text-primary">—</span>
						</div>
						<div className="text-xs font-mono text-on-surface-variant mt-1">
							REQUESTED_ITEM: <span className="text-secondary">—</span>
						</div>
					</div>
				</div>
			</div>

			{/* Expiry */}
			<div className="bg-surface-container-low rounded-xl p-6 border border-outline-variant/10 mb-8">
				<h2 className="text-xs font-mono uppercase tracking-widest text-on-surface-variant mb-4">
					Proposal_Expiry
				</h2>
				<div className="flex items-center gap-4">
					{["6h", "12h", "24h", "48h"].map((t, i) => (
						<button
							type="button"
							key={t}
							className={`px-4 py-2 rounded font-mono text-xs font-bold transition-all ${
								i === 2
									? "bg-primary-container text-on-primary-container"
									: "bg-surface-container-high text-on-surface-variant hover:text-on-surface border border-outline-variant/20"
							}`}
						>
							{t}
						</button>
					))}
				</div>
			</div>

			{/* Coming soon notice */}
			<div className="bg-surface-container-lowest rounded-xl p-6 border border-primary/10 flex items-start gap-4">
				<span className="material-symbols-outlined text-primary mt-0.5">construction</span>
				<div>
					<div className="text-xs font-mono text-primary font-bold mb-1">[PHASE_9_PENDING]</div>
					<p className="text-xs text-on-surface-variant font-sans">
						P2P audio trading via WebRTC is coming in Phase 9. This interface is a preview —
						no actual transfers can be initiated yet.
					</p>
				</div>
			</div>
		</div>
	);
}
