"use client";

import { useState, useTransition } from "react";
import {
	loadGenreGroupsAction,
	loadMemberGroupsAction,
} from "@/actions/community";
import type { GenreGroup, MemberGroup } from "@/lib/community/queries";
import { DISCOGS_GENRES } from "@/lib/discogs/taxonomy";
import { GenreGroupRow } from "./genre-group-row";
import { GroupCard } from "./group-card";
import { GroupFilterChips } from "./group-filter-chips";

interface GroupDiscoveryHubProps {
	initialGenreGroups: GenreGroup[];
	initialMemberGroups: MemberGroup[];
}

export function GroupDiscoveryHub({
	initialGenreGroups,
	initialMemberGroups,
}: GroupDiscoveryHubProps) {
	const [activeGenre, setActiveGenre] = useState<string | null>(null);
	const [genreGroups, setGenreGroups] =
		useState<GenreGroup[]>(initialGenreGroups);
	const [memberGroups, setMemberGroups] =
		useState<MemberGroup[]>(initialMemberGroups);
	const [showAllGenres, setShowAllGenres] = useState(false);
	const [hasMoreMembers, setHasMoreMembers] = useState(
		initialMemberGroups.length >= 10,
	);
	const [cursor, setCursor] = useState<string | null>(
		initialMemberGroups.length > 0
			? initialMemberGroups[initialMemberGroups.length - 1].createdAt
			: null,
	);
	const [isPending, startTransition] = useTransition();

	function handleGenreChange(genre: string | null) {
		setActiveGenre(genre);
		setShowAllGenres(false);
		startTransition(async () => {
			const [newGenreGroups, newMemberGroups] = await Promise.all([
				loadGenreGroupsAction(genre ?? undefined),
				loadMemberGroupsAction(genre ?? undefined),
			]);
			setGenreGroups(newGenreGroups);
			setMemberGroups(newMemberGroups);
			setHasMoreMembers(newMemberGroups.length >= 10);
			setCursor(
				newMemberGroups.length > 0
					? newMemberGroups[newMemberGroups.length - 1].createdAt
					: null,
			);
		});
	}

	function handleLoadMore() {
		if (!cursor) return;
		startTransition(async () => {
			const moreGroups = await loadMemberGroupsAction(
				activeGenre ?? undefined,
				cursor,
			);
			setMemberGroups((prev) => [...prev, ...moreGroups]);
			setHasMoreMembers(moreGroups.length >= 10);
			setCursor(
				moreGroups.length > 0
					? moreGroups[moreGroups.length - 1].createdAt
					: null,
			);
		});
	}

	const visibleGenreGroups = showAllGenres
		? genreGroups
		: genreGroups.slice(0, 6);

	return (
		<div className="space-y-8">
			{/* Filter Chips */}
			<GroupFilterChips
				genres={[...DISCOGS_GENRES]}
				activeGenre={activeGenre}
				onGenreChange={handleGenreChange}
			/>

			{/* Genre Groups Section */}
			<section>
				<h2 className="font-mono text-[10px] uppercase tracking-[0.2em] text-outline mb-4">
					GENRE_GROUPS
				</h2>
				<div className="space-y-1">
					{visibleGenreGroups.map((group) => (
						<GenreGroupRow
							key={group.id}
							name={group.name}
							slug={group.slug}
							memberCount={group.memberCount}
						/>
					))}
				</div>
				{!showAllGenres && genreGroups.length > 6 && (
					<button
						type="button"
						onClick={() => setShowAllGenres(true)}
						className="font-mono text-[10px] text-primary hover:text-primary/80 mt-3 transition-colors"
					>
						[show all genre groups]
					</button>
				)}
			</section>

			{/* Member Groups Section */}
			<section>
				<h2 className="font-mono text-[10px] uppercase tracking-[0.2em] text-outline mb-4">
					MEMBER_GROUPS
				</h2>

				{memberGroups.length === 0 ? (
					<div className="bg-surface-container-low border border-outline-variant/10 rounded p-8 text-center">
						<div className="font-mono text-[10px] text-outline mb-2">
							[NO_GROUPS_YET]
						</div>
						<p className="font-mono text-[10px] text-on-surface-variant">
							No community groups yet. Be the first to create one.
						</p>
					</div>
				) : (
					<div className="grid grid-cols-1 md:grid-cols-2 gap-3">
						{memberGroups.map((group) => (
							<GroupCard
								key={group.id}
								name={group.name}
								slug={group.slug}
								category={group.category}
								visibility={group.visibility}
								memberCount={group.memberCount}
								creatorUsername={group.creatorUsername}
							/>
						))}
					</div>
				)}

				{hasMoreMembers && memberGroups.length > 0 && (
					<div className="mt-4 text-center">
						<button
							type="button"
							onClick={handleLoadMore}
							disabled={isPending}
							className="font-mono text-[10px] text-primary hover:text-primary/80 transition-colors disabled:opacity-50"
						>
							{isPending ? "[loading...]" : "[load more]"}
						</button>
					</div>
				)}
			</section>
		</div>
	);
}
