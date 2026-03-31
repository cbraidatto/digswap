import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import {
	getInviteByToken,
	getGroupMembershipState,
} from "@/lib/community/queries";
import { InviteAcceptButton } from "./invite-accept-button";

export default async function JoinByTokenPage({
	params,
}: {
	params: Promise<{ token: string }>;
}) {
	const { token } = await params;

	const supabase = await createClient();
	const {
		data: { user },
	} = await supabase.auth.getUser();

	if (!user) {
		redirect("/login");
	}

	const invite = await getInviteByToken(token);

	// Invalid or expired invite
	if (!invite) {
		return (
			<div className="max-w-md mx-auto px-4 py-16 text-center">
				<span className="font-mono text-[10px] uppercase tracking-[0.2em] text-outline block mb-4">
					[INVITE_INVALID]
				</span>
				<p className="text-sm text-on-surface-variant mb-6">
					This invite link is no longer valid.
				</p>
				<Link
					href="/comunidade"
					className="font-mono text-[10px] text-primary border border-primary px-3 py-1 rounded hover:bg-primary/10 transition-colors"
				>
					[BACK_TO_COMMUNITY]
				</Link>
			</div>
		);
	}

	// Check if already a member
	const membership = await getGroupMembershipState(invite.groupId, user.id);

	if (membership.isMember) {
		return (
			<div className="max-w-md mx-auto px-4 py-16 text-center">
				<span className="font-mono text-[10px] uppercase tracking-[0.2em] text-outline block mb-4">
					[ALREADY_MEMBER]
				</span>
				<p className="text-sm text-on-surface-variant mb-6">
					You&apos;re already a member of this group.
				</p>
				<Link
					href={`/comunidade/${invite.groupSlug}`}
					className="font-mono text-[10px] text-primary border border-primary px-3 py-1 rounded hover:bg-primary/10 transition-colors"
				>
					[GO_TO_GROUP]
				</Link>
			</div>
		);
	}

	// Valid invite - show join option
	return (
		<div className="max-w-md mx-auto px-4 py-16 text-center">
			<span className="font-mono text-[10px] uppercase tracking-[0.2em] text-outline block mb-4">
				PRIVATE GROUP INVITE
			</span>
			<h1 className="font-heading text-xl font-semibold text-on-surface mb-2">
				{invite.groupName}
			</h1>
			<p className="font-mono text-[10px] text-on-surface-variant mb-8">
				{invite.memberCount}{" "}
				{invite.memberCount === 1 ? "member" : "members"} &middot; private
				group
			</p>

			<InviteAcceptButton
				token={token}
				groupName={invite.groupName}
				groupSlug={invite.groupSlug}
			/>

			<div className="mt-4">
				<Link
					href="/comunidade"
					className="font-mono text-[10px] text-on-surface-variant hover:text-on-surface transition-colors"
				>
					Decline
				</Link>
			</div>
		</div>
	);
}
