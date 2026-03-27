const SPEC_CHECKS = [
	{ label: "FORMAT", declared: "FLAC 24-bit/96kHz", actual: "FLAC 24-bit/96kHz", pass: true },
	{ label: "BITRATE", declared: "~4608 kbps", actual: "4608 kbps", pass: true },
	{ label: "DURATION", declared: "42:17", actual: "42:17", pass: true },
	{ label: "CHANNELS", declared: "Stereo (2.0)", actual: "Stereo (2.0)", pass: true },
	{ label: "MD5_HASH", declared: "—", actual: "a3f5c2...7b1d", pass: true },
];

export default function TradeReviewPage() {
	return (
		<div className="max-w-4xl mx-auto px-4 md:px-8 py-8">
			<div className="mb-8">
				<span className="text-[10px] font-mono text-primary tracking-[0.2em] uppercase">
					Protocol / Trade / Review
				</span>
				<h1 className="text-3xl font-bold font-heading text-on-surface mt-1 uppercase">
					SPEC_CHECK
				</h1>
				<p className="text-on-surface-variant font-mono text-xs mt-2">
					Verify audio file quality before accepting the trade.
				</p>
			</div>

			<div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
				{/* Preview */}
				<div className="bg-surface-container-low rounded-xl p-6 border border-outline-variant/10">
					<h2 className="text-xs font-mono uppercase tracking-widest text-on-surface-variant mb-4">
						Audio_Preview (1 min)
					</h2>
					<div className="bg-surface-container-lowest rounded-lg p-4 flex flex-col gap-3">
						<div className="flex items-center gap-3">
							<button
								type="button"
								className="w-10 h-10 bg-primary-container rounded-full flex items-center justify-center text-on-primary-container hover:brightness-110 transition-all"
							>
								<span className="material-symbols-outlined">play_arrow</span>
							</button>
							<div className="flex-1">
								<div className="h-1 bg-surface-container-high rounded-full">
									<div className="h-full w-1/3 bg-primary rounded-full" />
								</div>
							</div>
							<span className="font-mono text-xs text-on-surface-variant">0:20 / 1:00</span>
						</div>
						<div className="text-[10px] font-mono text-on-surface-variant text-center">
							Randomized position · [PHASE_9_PENDING]
						</div>
					</div>
				</div>

				{/* Spectrogram */}
				<div className="bg-surface-container-low rounded-xl p-6 border border-outline-variant/10">
					<h2 className="text-xs font-mono uppercase tracking-widest text-on-surface-variant mb-4">
						Spectrogram_Analysis
					</h2>
					<div className="bg-surface-container-lowest rounded-lg aspect-video flex items-center justify-center">
						<div className="text-center">
							<span className="material-symbols-outlined text-on-surface-variant/40 text-4xl block">
								bar_chart
							</span>
							<span className="text-[10px] font-mono text-on-surface-variant/40 mt-2 block">
								[PHASE_9_PENDING]
							</span>
						</div>
					</div>
				</div>
			</div>

			{/* Spec comparison table */}
			<div className="bg-surface-container-low rounded-xl overflow-hidden mb-8">
				<div className="bg-surface-container-high px-6 py-4 flex items-center gap-2">
					<span className="material-symbols-outlined text-primary text-[18px]">verified</span>
					<h2 className="text-xs font-mono uppercase tracking-widest text-on-surface">
						Metadata_Verification
					</h2>
				</div>
				<div className="divide-y divide-outline-variant/10">
					{SPEC_CHECKS.map((check) => (
						<div key={check.label} className="px-6 py-3 grid grid-cols-4 gap-4 items-center">
							<span className="font-mono text-xs text-on-surface-variant">{check.label}</span>
							<span className="font-mono text-xs text-on-surface">{check.declared}</span>
							<span className="font-mono text-xs text-on-surface">{check.actual}</span>
							<span
								className={`font-mono text-[10px] ${check.pass ? "text-primary" : "text-destructive"}`}
							>
								{check.pass ? "[PASS]" : "[FAIL]"}
							</span>
						</div>
					))}
				</div>
			</div>

			{/* Actions */}
			<div className="flex gap-4">
				<button
					type="button"
					className="flex-1 py-3 bg-primary-container text-on-primary-container font-mono text-sm font-bold rounded hover:brightness-110 transition-all flex items-center justify-center gap-2"
				>
					<span className="material-symbols-outlined">check_circle</span>
					ACCEPT_TRADE
				</button>
				<button
					type="button"
					className="flex-1 py-3 bg-surface-container-high text-on-surface-variant font-mono text-sm font-bold rounded hover:bg-surface-bright transition-all flex items-center justify-center gap-2 border border-outline-variant/20"
				>
					<span className="material-symbols-outlined">cancel</span>
					REJECT_TRADE
				</button>
			</div>
		</div>
	);
}
