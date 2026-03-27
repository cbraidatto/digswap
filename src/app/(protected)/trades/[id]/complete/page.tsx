export default function TradeCompletePage() {
	return (
		<div className="max-w-2xl mx-auto px-4 md:px-8 py-16 flex flex-col items-center text-center">
			{/* Success animation area */}
			<div className="relative mb-8">
				<div className="w-24 h-24 rounded-full bg-primary-container/20 border-2 border-primary flex items-center justify-center">
					<span className="material-symbols-outlined text-primary text-5xl">merge</span>
				</div>
				{/* Radial glow */}
				<div className="absolute inset-0 bg-primary/10 blur-2xl rounded-full pointer-events-none" />
			</div>

			<div className="mb-2">
				<span className="text-[10px] font-mono text-primary uppercase tracking-[0.3em]">
					STATUS / MERGED
				</span>
			</div>
			<h1 className="text-4xl font-bold font-heading text-on-surface mb-4 uppercase">
				TRADE_COMPLETE
			</h1>
			<p className="text-on-surface-variant font-sans text-sm mb-8 max-w-md">
				The P2P transfer was successful. Both parties have received the audio files.
				Rate the quality of the file you received to update the sharer&apos;s reputation.
			</p>

			{/* Trade summary */}
			<div className="w-full bg-surface-container-low rounded-xl p-6 mb-8 text-left border border-outline-variant/10">
				<h2 className="text-xs font-mono uppercase tracking-widest text-on-surface-variant mb-4">
					Trade_Summary
				</h2>
				<div className="space-y-2 font-mono text-xs">
					<div className="flex justify-between">
						<span className="text-on-surface-variant">TRADE_ID</span>
						<span className="text-primary">vnl-#942</span>
					</div>
					<div className="flex justify-between">
						<span className="text-on-surface-variant">COUNTERPARTY</span>
						<span className="text-secondary">bit_archeologist</span>
					</div>
					<div className="flex justify-between">
						<span className="text-on-surface-variant">FILES_TRANSFERRED</span>
						<span className="text-primary">[CONFIRMED]</span>
					</div>
					<div className="flex justify-between">
						<span className="text-on-surface-variant">XP_EARNED</span>
						<span className="text-tertiary">+150 XP</span>
					</div>
				</div>
			</div>

			{/* Rate quality */}
			<div className="w-full bg-surface-container-low rounded-xl p-6 mb-8 border border-outline-variant/10">
				<h2 className="text-xs font-mono uppercase tracking-widest text-on-surface-variant mb-4">
					Rate_File_Quality
				</h2>
				<div className="flex justify-center gap-3 mb-4">
					{[1, 2, 3, 4, 5].map((star) => (
						<button
							type="button"
							key={star}
							className="w-10 h-10 rounded bg-surface-container-high flex items-center justify-center text-on-surface-variant hover:text-primary transition-colors"
						>
							<span className="material-symbols-outlined">star</span>
						</button>
					))}
				</div>
				<input
					type="text"
					placeholder="Add a comment (optional)..."
					className="w-full bg-surface-container-lowest border-none text-xs font-mono text-on-surface placeholder:text-on-surface-variant/40 rounded p-3 outline-none border-l-2 border-primary/30 focus:border-primary transition-colors"
				/>
			</div>

			<div className="flex gap-4 w-full">
				<button
					type="button"
					className="flex-1 py-3 bg-primary-container text-on-primary-container font-mono text-sm font-bold rounded hover:brightness-110 transition-all"
				>
					SUBMIT_REVIEW
				</button>
				<button
					type="button"
					className="flex-1 py-3 bg-surface-container-high text-on-surface-variant font-mono text-sm rounded hover:bg-surface-bright transition-all border border-outline-variant/20"
				>
					SKIP
				</button>
			</div>
		</div>
	);
}
