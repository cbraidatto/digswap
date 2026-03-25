import { count, eq } from "drizzle-orm";
import Link from "next/link";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { collectionItems } from "@/lib/db/schema/collections";
import { profiles } from "@/lib/db/schema/users";
import { createClient } from "@/lib/supabase/server";
import { collectionFilterSchema } from "@/lib/collection/filters";
import {
	getCollectionPage,
	getCollectionCount,
	getUniqueGenres,
	getUniqueFormats,
	PAGE_SIZE,
} from "@/lib/collection/queries";
import { CollectionGrid } from "./_components/collection-grid";
import { CollectionSkeleton } from "./_components/collection-skeleton";
import { FilterBar } from "./_components/filter-bar";
import { Pagination } from "./_components/pagination";
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

interface PerfilPageProps {
	searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export default async function PerfilPage({ searchParams }: PerfilPageProps) {
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

	// 52 weeks x 7 days = 364 cells
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

	// Parse filters from search params
	const rawSearchParams = await searchParams;
	const filters = collectionFilterSchema.parse(rawSearchParams);

	// Fetch collection data in parallel
	const [items, totalCount, genres, formats] = await Promise.all([
		getCollectionPage(user.id, filters),
		getCollectionCount(user.id, filters),
		getUniqueGenres(user.id),
		getUniqueFormats(user.id),
	]);

	const totalPages = Math.ceil(totalCount / PAGE_SIZE);

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

				{/* Filter Bar */}
				<FilterBar
					genres={genres}
					formats={formats}
					currentFilters={filters}
					basePath="/perfil"
				/>

				{/* Collection Grid */}
				<CollectionGrid items={items} isOwner={true} />

				{/* Pagination */}
				{totalPages > 1 && (
					<Pagination
						currentPage={filters.page}
						totalPages={totalPages}
						baseUrl="/perfil"
						searchParams={rawSearchParams as Record<string, string>}
					/>
				)}
			</section>

			{/* Floating Action Button for adding records */}
			<AddRecordFAB />
		</div>
	);
}
