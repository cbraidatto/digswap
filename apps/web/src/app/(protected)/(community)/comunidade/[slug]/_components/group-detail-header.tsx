import { DISCOGS_GENRES } from "@/lib/discogs/taxonomy";
import { JoinLeaveButton } from "./join-leave-button";

interface GroupDetailHeaderProps {
	group: {
		id: string;
		name: string;
		slug: string;
		category: string | null;
		visibility: string;
		description: string | null;
		memberCount: number;
	};
	membership: {
		isMember: boolean;
		role: string | null;
	};
}

function getGroupType(category: string | null): string {
	if (!category) return "member group";
	const isGenre = (DISCOGS_GENRES as readonly string[]).includes(category);
	return isGenre ? "genre group" : "member group";
}

export function GroupDetailHeader({
	group,
	membership,
}: GroupDetailHeaderProps) {
	const groupType = getGroupType(group.category);

	return (
		<div className="mb-6 pb-6 border-b border-outline-variant/10">
			<div className="flex items-start justify-between gap-4">
				<div className="flex-1 min-w-0">
					<span className="font-mono text-[10px] uppercase tracking-[0.2em] text-outline">
						{group.name}
					</span>
					<p className="font-mono text-[10px] text-on-surface-variant mt-1">
						// {group.category ?? "general"} &middot; {groupType} &middot;{" "}
						{group.memberCount}{" "}
						{group.memberCount === 1 ? "member" : "members"}
					</p>
					{group.description && (
						<p className="text-sm text-on-surface-variant mt-3">
							{group.description}
						</p>
					)}
				</div>

				<JoinLeaveButton
					groupId={group.id}
					groupName={group.name}
					visibility={group.visibility}
					isMember={membership.isMember}
					role={membership.role}
					memberCount={group.memberCount}
				/>
			</div>
		</div>
	);
}
