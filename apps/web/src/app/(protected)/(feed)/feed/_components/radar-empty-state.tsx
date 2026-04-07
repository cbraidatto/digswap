import Link from "next/link";

export function RadarEmptyState() {
	return (
		<div className="mb-6 p-5 bg-surface-container-low border border-outline-variant/20 rounded-lg text-center">
			<span className="material-symbols-outlined text-4xl text-primary/40 mb-2 block">radar</span>
			<h3 className="font-heading text-sm font-semibold text-on-surface mb-1">No signal yet</h3>
			<p className="text-sm text-on-surface-variant mb-3">
				Connect your Discogs wantlist to activate the Radar and find who has what you&apos;re
				looking for.
			</p>
			<Link
				href="/settings"
				className="inline-flex items-center gap-1.5 text-sm font-medium text-primary hover:text-primary/80 transition-colors"
			>
				Connect Discogs
				<span className="material-symbols-outlined text-base">arrow_forward</span>
			</Link>
		</div>
	);
}
