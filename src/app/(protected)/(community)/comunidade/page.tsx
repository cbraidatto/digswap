import Link from "next/link";
import { loadGenreGroupsAction, loadMemberGroupsAction } from "@/actions/community";
import { GroupDiscoveryHub } from "./_components/group-discovery-hub";

export default async function ComunidadePage() {
	const [genreGroups, memberGroups] = await Promise.all([
		loadGenreGroupsAction(),
		loadMemberGroupsAction(),
	]);

	const totalGroups = genreGroups.length + memberGroups.length;

	return (
		<div className="max-w-4xl mx-auto px-4 md:px-8 py-8 space-y-8">
			{/* Header */}
			<div className="flex items-center justify-between">
				<div>
					<span className="font-mono text-[10px] uppercase tracking-[0.2em] text-outline">
						COMMUNITY_HUB
					</span>
					<p className="font-mono text-[10px] text-on-surface-variant mt-1">
						// {totalGroups} active groups
					</p>
				</div>
				<Link
					href="/comunidade/new"
					className="font-mono text-[10px] border border-primary text-primary px-3 py-1 rounded hover:bg-primary/10 transition-colors"
				>
					[+ CREATE_GROUP]
				</Link>
			</div>

			{/* Discovery Hub */}
			<GroupDiscoveryHub
				initialGenreGroups={genreGroups}
				initialMemberGroups={memberGroups}
			/>
		</div>
	);
}
