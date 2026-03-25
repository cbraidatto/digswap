import { eq } from "drizzle-orm";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { profiles } from "@/lib/db/schema/users";
import { collectionFilterSchema } from "@/lib/collection/filters";
import {
	getCollectionPage,
	getCollectionCount,
	getUniqueGenres,
	getUniqueFormats,
	PAGE_SIZE,
} from "@/lib/collection/queries";
import { CollectionGrid } from "@/app/(protected)/(profile)/perfil/_components/collection-grid";
import { Pagination } from "@/app/(protected)/(profile)/perfil/_components/pagination";

interface PublicProfilePageProps {
	params: Promise<{ username: string }>;
	searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export default async function PublicProfilePage({
	params,
	searchParams,
}: PublicProfilePageProps) {
	const { username } = await params;
	const rawSearchParams = await searchParams;

	// Look up user by username
	const [profile] = await db
		.select({
			id: profiles.id,
			displayName: profiles.displayName,
			avatarUrl: profiles.avatarUrl,
			username: profiles.username,
			createdAt: profiles.createdAt,
		})
		.from(profiles)
		.where(eq(profiles.username, username))
		.limit(1);

	if (!profile) {
		notFound();
	}

	// Parse filters from searchParams
	const filters = collectionFilterSchema.parse(rawSearchParams);

	// Fetch data in parallel
	const [items, totalCount, genres, formats] = await Promise.all([
		getCollectionPage(profile.id, filters),
		getCollectionCount(profile.id, filters),
		getUniqueGenres(profile.id),
		getUniqueFormats(profile.id),
	]);

	const totalPages = Math.ceil(totalCount / PAGE_SIZE);
	const displayName = profile.displayName ?? profile.username ?? "DIGGER";
	const memberYear = profile.createdAt
		? new Date(profile.createdAt).getFullYear()
		: new Date().getFullYear();

	return (
		<div className="max-w-7xl mx-auto px-4 md:px-6 py-8">
			{/* Profile Header */}
			<section className="mb-8">
				<div className="bg-surface-container-low p-6 rounded-lg flex items-center gap-6">
					<div className="w-16 h-16 bg-surface-container-high rounded border-2 border-primary/20 flex items-center justify-center shrink-0">
						{profile.avatarUrl ? (
							<img
								src={profile.avatarUrl}
								alt={displayName}
								className="w-full h-full object-cover rounded"
							/>
						) : (
							<span className="text-2xl font-mono font-bold text-primary">
								{displayName.charAt(0).toUpperCase()}
							</span>
						)}
					</div>
					<div>
						<h1 className="text-2xl font-bold tracking-tight font-heading text-on-surface">
							{displayName.toUpperCase()}
						</h1>
						<p className="text-on-surface-variant font-mono text-xs">
							Member since {memberYear} / {totalCount.toLocaleString()} records
						</p>
					</div>
				</div>
			</section>

			{/* Collection Grid */}
			<section>
				<div className="flex items-center justify-between mb-6">
					<div>
						<span className="text-[10px] font-mono text-primary tracking-[0.2em] uppercase">
							Repository
						</span>
						<h2 className="text-2xl font-bold font-heading text-on-surface mt-1">
							Collection
						</h2>
					</div>
					<div className="flex items-center gap-2 text-xs font-mono text-on-surface-variant">
						<span className="material-symbols-outlined text-[18px] text-primary">
							database
						</span>
						<span>{totalCount.toLocaleString()} records</span>
					</div>
				</div>

				<CollectionGrid items={items} isOwner={false} />

				{totalPages > 1 && (
					<Pagination
						currentPage={filters.page}
						totalPages={totalPages}
						baseUrl={`/perfil/${username}`}
						searchParams={rawSearchParams as Record<string, string>}
					/>
				)}
			</section>
		</div>
	);
}
