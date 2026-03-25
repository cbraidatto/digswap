import { count, eq } from "drizzle-orm";
import Link from "next/link";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { collectionItems } from "@/lib/db/schema/collections";
import { profiles } from "@/lib/db/schema/users";
import { createClient } from "@/lib/supabase/server";
import { AddRecordFAB } from "./_components/add-record-fab";

function getRankTitle(collectionCount: number): string {
	if (collectionCount >= 500) return "Record Archaeologist";
	if (collectionCount >= 200) return "Wax Prophet";
	if (collectionCount >= 50) return "Crate Digger";
	return "Vinyl Rookie";
}

function getRankLevel(collectionCount: number): number {
	return Math.min(Math.floor(collectionCount / 10) + 1, 99);
}

// Generate a fake contribution grid pattern for visual effect
function getContributionLevel(index: number, total: number): number {
	const pos = index / total;
	const noise = Math.sin(index * 2.3) * 0.5 + 0.5;
	if (pos < 0.3) return noise > 0.7 ? 1 : 0;
	if (pos < 0.6) return noise > 0.5 ? Math.floor(noise * 3) + 1 : 0;
	return noise > 0.4 ? Math.floor(noise * 4) : 0;
}

export default async function PerfilPage() {
	const supabase = await createClient();
	const {
		data: { user },
	} = await supabase.auth.getUser();

	if (!user) redirect("/signin");

	const [profile] = await db
		.select({
			displayName: profiles.displayName,
			avatarUrl: profiles.avatarUrl,
			discogsUsername: profiles.discogsUsername,
			discogsConnected: profiles.discogsConnected,
			createdAt: profiles.createdAt,
		})
		.from(profiles)
		.where(eq(profiles.id, user.id))
		.limit(1);

	const [{ value: collectionCount }] = await db
		.select({ value: count() })
		.from(collectionItems)
		.where(eq(collectionItems.userId, user.id));

	const displayName = profile?.displayName ?? "DIGGER";
	const rankTitle = getRankTitle(collectionCount);
	const rankLevel = getRankLevel(collectionCount);
	const memberYear = profile?.createdAt
		? new Date(profile.createdAt).getFullYear()
		: new Date().getFullYear();

	const xp = collectionCount * 10;

	// 52 weeks × 7 days = 364 cells
	const contributionCells = Array.from({ length: 364 }, (_, i) =>
		getContributionLevel(i, 364),
	);

	const CELL_COLORS = [
		"bg-outline-variant",
		"bg-primary/20",
		"bg-primary/50",
		"bg-primary/80",
		"bg-primary",
	];

	return (
		<div className="max-w-7xl mx-auto px-4 md:px-6 py-8">
			{/* User Header Bento */}
			<section className="grid grid-cols-1 md:grid-cols-12 gap-6 mb-12">
				{/* Identity Card */}
				<div className="md:col-span-4 bg-surface-container-low p-6 rounded-lg relative overflow-hidden">
					<div className="relative z-10">
						<div className="flex items-start justify-between mb-4">
							<div className="w-20 h-20 bg-surface-container-high rounded border-2 border-primary/20 flex items-center justify-center">
								{profile?.avatarUrl ? (
									<img
										src={profile.avatarUrl}
										alt={displayName}
										className="w-full h-full object-cover rounded"
									/>
								) : (
									<span className="text-3xl font-mono font-bold text-primary">
										{displayName.charAt(0).toUpperCase()}
									</span>
								)}
							</div>
							<span className="font-mono text-[10px] text-primary bg-primary/10 px-2 py-1 border border-primary/20 rounded">
								[AUTHENTICATED]
							</span>
						</div>
						<h1 className="text-3xl font-bold tracking-tight mb-1 font-heading">
							{displayName.toUpperCase()}
						</h1>
						<p className="text-on-surface-variant font-mono text-xs mb-4">
							Member since {memberYear} / Vinyl Network
						</p>
						<div className="flex items-center gap-2 bg-surface-container-high p-3 rounded border-l-2 border-secondary">
							<span className="material-symbols-outlined text-secondary">military_tech</span>
							<div>
								<div className="text-[10px] text-secondary font-mono uppercase tracking-widest">
									Class Status
								</div>
								<div className="text-sm font-bold font-heading">{rankTitle}</div>
							</div>
						</div>
					</div>
					{/* Decorative dot grid */}
					<div
						className="absolute inset-0 opacity-5 pointer-events-none"
						style={{
							backgroundImage: "radial-gradient(#6fdd78 1px, transparent 1px)",
							backgroundSize: "20px 20px",
						}}
					/>
				</div>

				{/* Contribution Graph */}
				<div className="md:col-span-8 bg-surface-container-low p-6 rounded-lg">
					<div className="flex justify-between items-center mb-6">
						<h3 className="text-xs font-mono uppercase tracking-widest text-on-surface-variant">
							Digging Activity / Annual_Log
						</h3>
						<div className="flex items-center gap-1 text-[10px] text-on-surface-variant font-mono">
							<span>Less</span>
							{CELL_COLORS.map((c) => (
								<div key={c} className={`w-3 h-3 ${c}`} />
							))}
							<span>More</span>
						</div>
					</div>
					<div
						className="grid gap-[2px] overflow-x-auto"
						style={{ gridTemplateColumns: "repeat(52, minmax(0, 1fr))" }}
					>
						{contributionCells.map((level, i) => (
							<div
								// biome-ignore lint/suspicious/noArrayIndexKey: static display grid
								key={i}
								className={`aspect-square ${CELL_COLORS[level]} rounded-[1px]`}
							/>
						))}
					</div>
				</div>
			</section>

			{/* Stats Row */}
			<section className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-12">
				{[
					{ label: "RECORDS", value: collectionCount.toLocaleString(), color: "text-primary", icon: "album" },
					{ label: "XP_SCORE", value: xp.toLocaleString(), color: "text-secondary", icon: "bolt" },
					{ label: "LEVEL", value: `LVL_${rankLevel}`, color: "text-tertiary", icon: "military_tech" },
					{ label: "TRADES", value: "0", color: "text-primary", icon: "swap_horiz" },
				].map((stat) => (
					<div
						key={stat.label}
						className="bg-surface-container-low p-4 rounded-lg border border-outline-variant/10"
					>
						<div className="flex items-center gap-2 mb-2">
							<span className={`material-symbols-outlined text-sm ${stat.color}`}>
								{stat.icon}
							</span>
							<span className="text-[10px] font-mono text-on-surface-variant uppercase tracking-widest">
								{stat.label}
							</span>
						</div>
						<div className={`text-2xl font-bold font-heading ${stat.color}`}>{stat.value}</div>
					</div>
				))}
			</section>

			{/* Collection Repository */}
			<section>
				<div className="flex items-center justify-between mb-6">
					<div>
						<span className="text-[10px] font-mono text-primary tracking-[0.2em] uppercase">
							Repository
						</span>
						<h2 className="text-2xl font-bold font-heading text-on-surface mt-1">
							Your_Collection
						</h2>
					</div>
					<Link
						href="/settings"
						className="flex items-center gap-2 px-4 py-2 bg-primary-container text-on-primary-container font-mono text-xs font-bold rounded hover:brightness-110 transition-all"
					>
						<span className="material-symbols-outlined text-sm">add</span>
						ADD_RECORD
					</Link>
				</div>

				{collectionCount === 0 ? (
					<div className="bg-surface-container-low rounded-xl p-12 flex flex-col items-center gap-4 text-center border border-outline-variant/10">
						<div className="w-16 h-16 bg-surface-container-high rounded-full flex items-center justify-center">
							<span className="material-symbols-outlined text-primary text-3xl">album</span>
						</div>
						<div>
							<div className="text-[10px] font-mono text-primary uppercase tracking-widest mb-2">
								EMPTY_REPOSITORY
							</div>
							<h3 className="text-lg font-bold font-heading text-on-surface mb-2">
								No records committed yet
							</h3>
							<p className="text-sm text-on-surface-variant font-sans max-w-sm">
								Connect your Discogs account to import your collection, or add records manually.
							</p>
						</div>
						<Link
							href="/settings"
							className="mt-2 px-6 py-2 bg-primary-container text-on-primary-container font-mono text-xs font-bold rounded hover:brightness-110 transition-all"
						>
							CONNECT_DISCOGS
						</Link>
					</div>
				) : (
					<div className="bg-surface-container-low rounded-xl overflow-hidden shadow-lg">
						<div className="bg-surface-container-high px-6 py-4 flex items-center justify-between border-b border-outline-variant/10">
							<div className="flex items-center gap-2 text-primary">
								<span className="material-symbols-outlined text-[18px]">database</span>
								<span className="text-xs font-bold font-mono">
									{collectionCount.toLocaleString()} records
								</span>
							</div>
							<div className="flex items-center gap-3 text-xs font-mono text-on-surface-variant">
								{profile?.discogsConnected && (
									<span className="text-primary bg-primary/10 px-2 py-0.5 rounded border border-primary/20">
										[DISCOGS_LINKED]
									</span>
								)}
							</div>
						</div>
						<div className="p-6">
							<div className="text-center text-on-surface-variant font-mono text-sm py-8">
								<span className="material-symbols-outlined text-primary text-3xl block mb-2">
									construction
								</span>
								Collection browser coming in Phase 4...
							</div>
						</div>
					</div>
				)}
			</section>

			{/* Floating Action Button for adding records */}
			<AddRecordFAB />
		</div>
	);
}
