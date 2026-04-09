import { eq } from "drizzle-orm";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { GemBadge } from "@/components/ui/gem-badge";
import { db } from "@/lib/db";
import { collectionItems } from "@/lib/db/schema/collections";
import { profiles } from "@/lib/db/schema/users";
import { type ComparisonItem, getCollectionComparison } from "@/lib/social/comparison";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = {
	title: "Compare collections — DigSwap",
	description: "See the overlap and unique records between two vinyl collections.",
};

interface ComparePageProps {
	params: Promise<{ username: string }>;
}

function ComparisonColumn({
	label,
	items,
	accentColor,
	emptyText,
}: {
	label: string;
	items: ComparisonItem[];
	accentColor: "text-secondary" | "text-primary" | "text-tertiary";
	emptyText: string;
}) {
	const bgOpacity =
		accentColor === "text-secondary"
			? "bg-secondary/10"
			: accentColor === "text-primary"
				? "bg-primary/10"
				: "bg-tertiary/10";

	return (
		<section aria-label={`Records ${label.toLowerCase().replace(/_/g, " ")}`}>
			{/* Header */}
			<div className="flex items-center justify-between mb-4">
				<span className={`font-mono text-xs uppercase tracking-[0.2em] ${accentColor}`}>
					{label}
				</span>
				<span className={`font-mono text-xs px-2 py-0.5 rounded ${accentColor} ${bgOpacity}`}>
					{items.length}
				</span>
			</div>
			{/* Records list */}
			<div className="bg-surface-container-low rounded-lg border border-outline-variant/10 max-h-[60vh] overflow-y-auto">
				{items.length === 0 ? (
					<div className="font-mono text-sm text-on-surface-variant text-center py-8">
						{emptyText}
					</div>
				) : (
					items.map((item) => (
						<div
							key={item.releaseId}
							className="px-4 py-3 border-b border-outline-variant/5 last:border-0"
						>
							<div className="font-mono text-xs text-on-surface-variant">{item.artist}</div>
							<div className="font-heading text-sm font-bold text-on-surface truncate">
								{item.title}
							</div>
							<div className="mt-1">
								<GemBadge score={item.rarityScore} showScore={true} />
							</div>
						</div>
					))
				)}
			</div>
		</section>
	);
}

export default async function ComparePage({ params }: ComparePageProps) {
	const { username } = await params;

	// Auth check
	const supabase = await createClient();
	const {
		data: { user },
	} = await supabase.auth.getUser();

	if (!user) redirect("/signin");

	// Lookup target profile
	const [targetProfile] = await db
		.select({
			id: profiles.id,
			displayName: profiles.displayName,
			username: profiles.username,
		})
		.from(profiles)
		.where(eq(profiles.username, username))
		.limit(1);

	if (!targetProfile) notFound();

	// Self-redirect: comparing with yourself is meaningless
	if (user.id === targetProfile.id) redirect("/perfil");

	// Check if current user has any collection items
	const [myCollectionCheck] = await db
		.select({ releaseId: collectionItems.releaseId })
		.from(collectionItems)
		.where(eq(collectionItems.userId, user.id))
		.limit(1);

	if (!myCollectionCheck) {
		return (
			<div className="max-w-7xl mx-auto px-4 md:px-6 py-8">
				{/* Back link */}
				<Link
					href={`/perfil/${username}`}
					className="font-mono text-xs text-on-surface-variant hover:text-primary flex items-center gap-1"
				>
					<span className="material-symbols-outlined text-base">arrow_back</span>
					&lt; back to @{username}
				</Link>
				<h1 className="text-3xl font-heading font-bold text-on-surface mt-2">
					COLLECTION_COMPARISON
				</h1>
				<div className="mt-8 text-center py-16">
					<p className="font-mono text-sm text-on-surface-variant">
						you need records in your collection to compare.
					</p>
					<p className="font-mono text-xs text-outline mt-2">
						import from Discogs or add records manually.
					</p>
				</div>
			</div>
		);
	}

	// Fetch comparison
	const comparison = await getCollectionComparison(user.id, targetProfile.id);

	return (
		<div className="max-w-7xl mx-auto px-4 md:px-6 py-8">
			{/* Page header */}
			<Link
				href={`/perfil/${username}`}
				className="font-mono text-xs text-on-surface-variant hover:text-primary flex items-center gap-1"
			>
				<span className="material-symbols-outlined text-base">arrow_back</span>
				&lt; back to @{username}
			</Link>
			<h1 className="text-3xl font-heading font-bold text-on-surface mt-2">
				COLLECTION_COMPARISON
			</h1>
			<p className="font-mono text-xs text-on-surface-variant mt-1">
				Your collection vs @{username}
			</p>

			{/* 3-column comparison grid */}
			<div className="grid grid-cols-1 md:grid-cols-3 gap-8 mt-8">
				<ComparisonColumn
					label="UNIQUE_TO_YOU"
					items={comparison.uniqueToMe}
					accentColor="text-secondary"
					emptyText="all your records are shared"
				/>
				<ComparisonColumn
					label="IN_COMMON"
					items={comparison.inCommon}
					accentColor="text-primary"
					emptyText="no records in common"
				/>
				<ComparisonColumn
					label="UNIQUE_TO_THEM"
					items={comparison.uniqueToThem}
					accentColor="text-tertiary"
					emptyText="all their records are shared"
				/>
			</div>
		</div>
	);
}
