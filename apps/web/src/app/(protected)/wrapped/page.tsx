import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { generateWrapped } from "@/actions/wrapped";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = {
	title: "Year in Crates — DigSwap",
	description: "Your year in vinyl — records added, rarest finds, top genres, and more.",
};

export default async function WrappedPage() {
	const supabase = await createClient();
	const {
		data: { user },
	} = await supabase.auth.getUser();

	if (!user) redirect("/signin");

	const stats = await generateWrapped(user.id);

	if (!stats) {
		return (
			<div className="min-h-[60vh] flex flex-col items-center justify-center text-center p-6">
				<span className="material-symbols-outlined text-5xl text-on-surface-variant/30 mb-4">
					auto_awesome
				</span>
				<h1 className="font-heading text-2xl font-bold text-on-surface mb-2">Year in Crates</h1>
				<p className="text-sm text-on-surface-variant max-w-sm">
					Start adding records to your collection to generate your year-end wrapped.
				</p>
			</div>
		);
	}

	return (
		<div className="max-w-2xl mx-auto p-4 md:p-8">
			{/* Header */}
			<div className="text-center mb-10">
				<span className="material-symbols-outlined text-4xl text-primary mb-2 block">
					auto_awesome
				</span>
				<h1 className="font-heading text-3xl md:text-4xl font-extrabold text-on-surface">
					{stats.year} in Crates
				</h1>
				<p className="text-sm text-on-surface-variant mt-1">Your year in vinyl</p>
			</div>

			{/* Big numbers */}
			<div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-10">
				<StatCard value={stats.recordsAdded.toString()} label="Records added" icon="album" />
				<StatCard
					value={stats.reviewsWritten.toString()}
					label="Reviews written"
					icon="rate_review"
				/>
				<StatCard value={stats.followersGained.toString()} label="New followers" icon="group_add" />
				<StatCard value={stats.avgRarity.toFixed(1)} label="Avg rarity" icon="diamond" />
			</div>

			{/* Rarest find */}
			{stats.rarestFind && (
				<div className="bg-surface-container-low rounded-xl border border-tertiary/20 p-6 mb-6">
					<div className="flex items-center gap-2 mb-3">
						<span className="material-symbols-outlined text-tertiary">diamond</span>
						<h2 className="font-heading text-base font-semibold text-on-surface">Rarest find</h2>
					</div>
					<p className="font-heading text-lg font-bold text-on-surface">{stats.rarestFind.title}</p>
					<p className="text-sm text-on-surface-variant">
						{stats.rarestFind.artist} · Rarity: {stats.rarestFind.rarityScore.toFixed(1)}
					</p>
				</div>
			)}

			{/* Top genres */}
			{stats.topGenres.length > 0 && (
				<div className="bg-surface-container-low rounded-xl border border-outline-variant/10 p-6 mb-6">
					<h2 className="font-heading text-base font-semibold text-on-surface mb-4 flex items-center gap-2">
						<span className="material-symbols-outlined text-primary">music_note</span>
						Top genres
					</h2>
					<div className="space-y-3">
						{stats.topGenres.map((g, i) => (
							<div key={g.name} className="flex items-center gap-3">
								<span className="font-heading text-xl font-bold text-on-surface-variant/30 w-6 text-right">
									{i + 1}
								</span>
								<span className="text-sm text-on-surface flex-1">{g.name}</span>
								<span className="text-xs text-on-surface-variant">{g.count} records</span>
							</div>
						))}
					</div>
				</div>
			)}

			{/* Top artists */}
			{stats.topArtists.length > 0 && (
				<div className="bg-surface-container-low rounded-xl border border-outline-variant/10 p-6 mb-6">
					<h2 className="font-heading text-base font-semibold text-on-surface mb-4 flex items-center gap-2">
						<span className="material-symbols-outlined text-secondary">person</span>
						Most collected artists
					</h2>
					<div className="space-y-3">
						{stats.topArtists.map((a, i) => (
							<div key={a.name} className="flex items-center gap-3">
								<span className="font-heading text-xl font-bold text-on-surface-variant/30 w-6 text-right">
									{i + 1}
								</span>
								<span className="text-sm text-on-surface flex-1">{a.name}</span>
								<span className="text-xs text-on-surface-variant">{a.count} records</span>
							</div>
						))}
					</div>
				</div>
			)}

			{/* Verdict */}
			<div className="text-center py-8">
				<p className="text-xs text-on-surface-variant uppercase tracking-wider mb-2">
					Collection status
				</p>
				<p className="font-heading text-3xl font-extrabold text-primary">{stats.totalValue}</p>
			</div>
		</div>
	);
}

function StatCard({ value, label, icon }: { value: string; label: string; icon: string }) {
	return (
		<div className="bg-surface-container-low rounded-xl border border-outline-variant/10 p-4 text-center">
			<span className="material-symbols-outlined text-xl text-primary/60 mb-1 block">{icon}</span>
			<div className="font-heading text-2xl font-bold text-on-surface">{value}</div>
			<div className="text-xs text-on-surface-variant">{label}</div>
		</div>
	);
}
