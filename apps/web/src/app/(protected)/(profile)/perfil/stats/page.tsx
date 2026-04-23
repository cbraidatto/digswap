import { and, avg, count, desc, eq, isNull, sql } from "drizzle-orm";
import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { collectionItems } from "@/lib/db/schema/collections";
import { listeningLogs } from "@/lib/db/schema/listening-logs";
import { releases } from "@/lib/db/schema/releases";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = {
	title: "My Stats — DigSwap",
	description: "Vinyl collection statistics: top genres, decades, labels and more.",
};

// ── Helpers ────────────────────────────────────────────────

function Bar({ value, max }: { value: number; max: number }) {
	const pct = max > 0 ? Math.round((value / max) * 100) : 0;
	return (
		<div className="flex items-center gap-3 w-full">
			<div className="flex-1 h-1.5 bg-outline/10 rounded-full overflow-hidden">
				<div
					className="h-full bg-primary rounded-full transition-all"
					style={{ width: `${pct}%` }}
				/>
			</div>
			<span className="font-mono text-xs text-primary w-8 text-right">{value}</span>
		</div>
	);
}

export default async function StatsPage() {
	const supabase = await createClient();
	const {
		data: { user },
	} = await supabase.auth.getUser();

	if (!user) redirect("/signin");

	const userId = user.id;

	// Run all queries in parallel
	const [
		topGenresRaw,
		topDecadesRaw,
		topLabelsRaw,
		avgRarityRaw,
		totalRecordsRaw,
		totalListensRaw,
	] = await Promise.all([
		// Top 5 genres via unnest
		db
			.select({
				genre: sql<string>`unnest(${releases.genre})`,
				count: sql<number>`cast(count(*) as int)`,
			})
			.from(collectionItems)
			.innerJoin(releases, eq(collectionItems.releaseId, releases.id))
			.where(and(eq(collectionItems.userId, userId), isNull(collectionItems.deletedAt)))
			.groupBy(sql`unnest(${releases.genre})`)
			.orderBy(desc(sql`count(*)`))
			.limit(5),

		// Top 5 decades
		db
			.select({
				decade: sql<string>`(floor(${releases.year} / 10) * 10)::int || 's'`,
				count: sql<number>`cast(count(*) as int)`,
			})
			.from(collectionItems)
			.innerJoin(releases, eq(collectionItems.releaseId, releases.id))
			.where(and(eq(collectionItems.userId, userId), isNull(collectionItems.deletedAt)))
			.groupBy(sql`floor(${releases.year} / 10) * 10`)
			.orderBy(desc(sql`count(*)`))
			.limit(5),

		// Top 5 labels
		db
			.select({
				label: releases.label,
				count: sql<number>`cast(count(*) as int)`,
			})
			.from(collectionItems)
			.innerJoin(releases, eq(collectionItems.releaseId, releases.id))
			.where(and(eq(collectionItems.userId, userId), isNull(collectionItems.deletedAt)))
			.groupBy(releases.label)
			.orderBy(desc(sql`count(*)`))
			.limit(5),

		// Average rarity score
		db
			.select({ avg: avg(releases.rarityScore) })
			.from(collectionItems)
			.innerJoin(releases, eq(collectionItems.releaseId, releases.id))
			.where(and(eq(collectionItems.userId, userId), isNull(collectionItems.deletedAt))),

		// Total records
		db
			.select({ total: count() })
			.from(collectionItems)
			.where(and(eq(collectionItems.userId, userId), isNull(collectionItems.deletedAt))),

		// Total listens
		db.select({ total: count() }).from(listeningLogs).where(eq(listeningLogs.userId, userId)),
	]);

	const topGenres = topGenresRaw.filter((r) => r.genre != null);
	const topDecades = topDecadesRaw.filter((r) => r.decade != null);
	const topLabels = topLabelsRaw.filter((r) => r.label != null);
	const avgRarity = avgRarityRaw[0]?.avg != null ? Number(avgRarityRaw[0].avg) : 0;
	const totalRecords = totalRecordsRaw[0]?.total ?? 0;
	const totalListens = totalListensRaw[0]?.total ?? 0;

	const maxGenreCount = topGenres[0]?.count ?? 1;
	const maxDecadeCount = topDecades[0]?.count ?? 1;
	const maxLabelCount = topLabels[0]?.count ?? 1;

	return (
		<div className="max-w-3xl mx-auto px-4 md:px-6 py-10 space-y-10">
			{/* Header */}
			<div className="flex items-center justify-between">
				<div>
					<span className="font-mono text-[10px] uppercase tracking-[0.2em] text-primary">
						Collection Analytics
					</span>
					<h1 className="text-3xl font-bold font-heading text-on-surface mt-1">Your_Stats</h1>
				</div>
				<Link
					href="/perfil"
					className="font-mono text-xs text-on-surface-variant hover:text-primary transition-colors tracking-[0.12em]"
				>
					← Back
				</Link>
			</div>

			{/* Summary row */}
			<div className="grid grid-cols-3 gap-4">
				{[
					{
						label: "Records",
						value: totalRecords.toLocaleString(),
						icon: "album",
						color: "text-primary",
					},
					{
						label: "Avg Rarity",
						value: avgRarity.toFixed(1),
						icon: "diamond",
						color: "text-secondary",
					},
					{
						label: "Listens",
						value: totalListens.toLocaleString(),
						icon: "headphones",
						color: "text-tertiary",
					},
				].map((stat) => (
					<div
						key={stat.label}
						className="bg-surface-container-low rounded-lg p-4 border border-outline-variant/10 flex flex-col gap-1"
					>
						<div className="flex items-center gap-1.5">
							<span className={`material-symbols-outlined text-sm ${stat.color}`}>{stat.icon}</span>
							<span className="font-mono text-[9px] uppercase tracking-[0.18em] text-on-surface-variant">
								{stat.label}
							</span>
						</div>
						<p className={`text-3xl font-bold font-heading leading-none ${stat.color}`}>
							{stat.value}
						</p>
					</div>
				))}
			</div>

			{/* Three column breakdown */}
			<div className="grid grid-cols-1 md:grid-cols-3 gap-6">
				{/* Top Genres */}
				<StatSection title="Top Genres" icon="queue_music" color="text-primary">
					{topGenres.length > 0 ? (
						topGenres.map((g) => (
							<StatRow key={g.genre} label={g.genre} count={g.count} max={maxGenreCount} />
						))
					) : (
						<Empty />
					)}
				</StatSection>

				{/* Top Decades */}
				<StatSection title="Top Decades" icon="history" color="text-secondary">
					{topDecades.length > 0 ? (
						topDecades.map((d) => (
							<StatRow key={d.decade} label={d.decade} count={d.count} max={maxDecadeCount} />
						))
					) : (
						<Empty />
					)}
				</StatSection>

				{/* Top Labels */}
				<StatSection title="Top Labels" icon="label" color="text-tertiary">
					{topLabels.length > 0 ? (
						topLabels.map((l) => (
							<StatRow key={l.label} label={l.label ?? ""} count={l.count} max={maxLabelCount} />
						))
					) : (
						<Empty />
					)}
				</StatSection>
			</div>
		</div>
	);
}

// ── Sub-components ─────────────────────────────────────────

function StatSection({
	title,
	icon,
	color,
	children,
}: {
	title: string;
	icon: string;
	color: string;
	children: React.ReactNode;
}) {
	return (
		<div className="bg-surface-container-low rounded-lg p-4 border border-outline-variant/10">
			<div className="flex items-center gap-1.5 mb-4">
				<span className={`material-symbols-outlined text-sm ${color}`}>{icon}</span>
				<h2 className="font-mono text-[10px] uppercase tracking-[0.18em] text-on-surface-variant">
					{title}
				</h2>
			</div>
			<div className="space-y-3">{children}</div>
		</div>
	);
}

function StatRow({ label, count, max }: { label: string; count: number; max: number }) {
	return (
		<div>
			<div className="flex items-center justify-between mb-1">
				<span className="font-mono text-xs text-on-surface truncate max-w-[140px]" title={label}>
					{label}
				</span>
			</div>
			<Bar value={count} max={max} />
		</div>
	);
}

function Empty() {
	return <p className="font-mono text-xs text-outline/60 italic">no data yet</p>;
}
