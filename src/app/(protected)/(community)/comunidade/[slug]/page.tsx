import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import {
	getGroupBySlug,
	getGroupMembershipState,
	getGroupPosts,
} from "@/lib/community/queries";
import { GroupDetailHeader } from "./_components/group-detail-header";
import { InviteControls } from "./_components/invite-controls";
import { GroupContentSection } from "./_components/group-content-section";

export default async function GroupDetailPage({
	params,
}: {
	params: Promise<{ slug: string }>;
}) {
	const { slug } = await params;

	const supabase = await createClient();
	const {
		data: { user },
	} = await supabase.auth.getUser();

	if (!user) {
		redirect("/login");
	}

	const group = await getGroupBySlug(slug);

	if (!group) {
		return (
			<div className="max-w-4xl mx-auto px-4 md:px-8 py-8">
				<div className="flex flex-col items-center justify-center py-16 text-center">
					<span className="font-mono text-[10px] uppercase tracking-[0.2em] text-outline mb-4">
						[GROUP_NOT_FOUND]
					</span>
					<p className="text-sm text-on-surface-variant mb-6">
						This group does not exist or may have been removed.
					</p>
					<Link
						href="/comunidade"
						className="font-mono text-[10px] text-primary border border-primary px-3 py-1 rounded hover:bg-primary/10 transition-colors"
					>
						[BACK_TO_COMMUNITY]
					</Link>
				</div>
			</div>
		);
	}

	const membership = await getGroupMembershipState(group.id, user.id);

	// Only fetch posts if user is a member or group is public
	const canViewPosts = membership.isMember || group.visibility === "public";
	const initialPosts = canViewPosts ? await getGroupPosts(group.id) : [];

	const isAdmin = membership.role === "admin";
	const isPrivateAndNotMember =
		group.visibility === "private" && !membership.isMember;

	return (
		<div className="max-w-4xl mx-auto px-4 md:px-8 py-8">
			<GroupDetailHeader group={group} membership={membership} />

			{isAdmin && (
				<InviteControls groupId={group.id} groupSlug={group.slug} />
			)}

			{isPrivateAndNotMember ? (
				<div className="flex flex-col items-center justify-center py-16 text-center">
					<span className="font-mono text-[10px] uppercase tracking-[0.2em] text-outline mb-4">
						[INVITE_ONLY]
					</span>
					<p className="text-sm text-on-surface-variant">
						This is a private group. You need an invite to view its content.
					</p>
				</div>
			) : (
				<GroupContentSection
					groupId={group.id}
					groupName={group.name}
					isMember={membership.isMember}
					initialPosts={initialPosts}
				/>
			)}
		</div>
	);
}
