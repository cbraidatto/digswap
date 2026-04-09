import Link from "next/link";

export function RadarEmptyState() {
	return (
		<div className="mb-8 p-8 bg-surface-container-low border border-outline-variant/10 rounded-2xl text-center relative overflow-hidden">
			{/* Background glow */}
			<div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-secondary/5" />

			<div className="relative z-10">
				<div className="w-16 h-16 rounded-2xl bg-primary/8 flex items-center justify-center mx-auto mb-4">
					<span
						className="material-symbols-outlined text-3xl text-primary/50"
						style={{ fontVariationSettings: "'FILL' 1" }}
					>
						radar
					</span>
				</div>
				<h3 className="font-heading text-base font-bold text-on-surface mb-1.5">No signal yet</h3>
				<p className="text-sm text-on-surface-variant/70 mb-5 max-w-xs mx-auto">
					Connect your Discogs wantlist to activate the Radar and find who has what you&apos;re
					looking for.
				</p>
				<Link
					href="/settings"
					className="inline-flex items-center gap-2 text-sm font-semibold text-background bg-primary hover:bg-primary/90 px-5 py-2.5 rounded-xl transition-colors shadow-md shadow-primary/20"
				>
					Connect Discogs
					<span className="material-symbols-outlined text-base">arrow_forward</span>
				</Link>
			</div>
		</div>
	);
}
