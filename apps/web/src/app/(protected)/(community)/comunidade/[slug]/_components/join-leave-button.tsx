"use client";

import { useState, useTransition } from "react";
import { joinGroupAction, leaveGroupAction } from "@/actions/community";
import { toast } from "sonner";

interface JoinLeaveButtonProps {
	groupId: string;
	groupName: string;
	visibility: string;
	isMember: boolean;
	role: string | null;
	memberCount: number;
}

export function JoinLeaveButton({
	groupId,
	groupName,
	visibility,
	isMember: isMemberInitial,
	role,
	memberCount: memberCountInitial,
}: JoinLeaveButtonProps) {
	const [isMemberLocal, setIsMemberLocal] = useState(isMemberInitial);
	const [memberCountLocal, setMemberCountLocal] =
		useState(memberCountInitial);
	const [showLeaveConfirm, setShowLeaveConfirm] = useState(false);
	const [isHovered, setIsHovered] = useState(false);
	const [isPending, startTransition] = useTransition();

	// Creator (sole admin) should not see the button
	if (role === "admin" && isMemberLocal) {
		return null;
	}

	// Private group + not a member: show invite-only label
	if (visibility === "private" && !isMemberLocal) {
		return (
			<span className="font-mono text-xs text-on-surface-variant whitespace-nowrap">
				[INVITE_ONLY]
			</span>
		);
	}

	// Handle join
	function handleJoin() {
		// Optimistic update
		setIsMemberLocal(true);
		setMemberCountLocal((prev) => prev + 1);

		startTransition(async () => {
			const result = await joinGroupAction(groupId);
			if (result.error) {
				// Revert optimistic update
				setIsMemberLocal(false);
				setMemberCountLocal((prev) => prev - 1);
				toast("Failed to join group. Please try again.");
			} else {
				toast(`Joined ${groupName}.`);
			}
		});
	}

	// Handle leave confirmation
	function handleLeaveConfirm() {
		// Optimistic update
		setIsMemberLocal(false);
		setMemberCountLocal((prev) => Math.max(0, prev - 1));
		setShowLeaveConfirm(false);

		startTransition(async () => {
			const result = await leaveGroupAction(groupId);
			if (result.error) {
				// Revert optimistic update
				setIsMemberLocal(true);
				setMemberCountLocal((prev) => prev + 1);
				toast("Failed to leave group. Please try again.");
			} else {
				toast(`Left ${groupName}.`);
			}
		});
	}

	// Leave confirmation inline
	if (showLeaveConfirm) {
		return (
			<div className="flex items-center gap-2 whitespace-nowrap">
				<span className="font-mono text-xs text-on-surface-variant">
					Leave {groupName}?
				</span>
				<button
					type="button"
					onClick={handleLeaveConfirm}
					disabled={isPending}
					className="font-mono text-xs text-destructive border border-destructive px-2 py-0.5 rounded hover:bg-destructive/10 transition-colors disabled:opacity-50"
				>
					[Confirm]
				</button>
				<button
					type="button"
					onClick={() => setShowLeaveConfirm(false)}
					className="font-mono text-xs text-on-surface-variant border border-outline-variant/20 px-2 py-0.5 rounded hover:text-on-surface transition-colors"
				>
					[Cancel]
				</button>
			</div>
		);
	}

	// Not a member: show join button
	if (!isMemberLocal) {
		return (
			<button
				type="button"
				onClick={handleJoin}
				disabled={isPending}
				aria-label={`Join ${groupName}`}
				className="font-mono text-xs border border-primary text-primary px-3 py-1 rounded hover:bg-primary/10 transition-colors whitespace-nowrap disabled:opacity-50"
			>
				Join group
			</button>
		);
	}

	// Member: show joined / leave on hover
	return (
		<button
			type="button"
			onMouseEnter={() => setIsHovered(true)}
			onMouseLeave={() => setIsHovered(false)}
			onClick={() => setShowLeaveConfirm(true)}
			disabled={isPending}
			className={
				isHovered
					? "font-mono text-xs text-destructive border border-destructive px-3 py-1 rounded hover:bg-destructive/10 transition-colors whitespace-nowrap disabled:opacity-50"
					: "font-mono text-xs text-primary px-3 py-1 whitespace-nowrap"
			}
		>
			{isHovered ? "Leave group" : "Joined"}
		</button>
	);
}
