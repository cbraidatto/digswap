export function P2PDisabledBanner() {
	return (
		<div className="max-w-4xl mx-auto px-4 md:px-8 py-16">
			<div className="border-l-4 border-destructive bg-surface-container-low p-6 rounded-r-lg">
				<span className="material-symbols-outlined text-destructive text-4xl mb-4 block">
					shield_lock
				</span>
				<div className="text-[10px] font-mono text-destructive uppercase tracking-[0.2em] mb-2">
					[P2P_DISABLED]
				</div>
				<p className="text-sm text-on-surface-variant font-sans">
					DMCA registration pending -- trading will be enabled once compliance
					infrastructure is operational.
				</p>
			</div>
		</div>
	);
}
