"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { generateInviteAction, inviteUserAction } from "@/actions/community";

interface InviteControlsProps {
	groupId: string;
	groupSlug: string;
}

export function InviteControls({ groupId, groupSlug: _groupSlug }: InviteControlsProps) {
	const [showInviteInput, setShowInviteInput] = useState(false);
	const [username, setUsername] = useState("");
	const [inviteError, setInviteError] = useState<string | null>(null);
	const [isPending, startTransition] = useTransition();

	function handleInviteUser(e: React.FormEvent) {
		e.preventDefault();
		const trimmed = username.trim();
		if (!trimmed) return;

		setInviteError(null);

		startTransition(async () => {
			const result = await inviteUserAction(groupId, trimmed);
			if (result.error) {
				setInviteError(result.error);
			} else {
				toast(`Invite sent to @${trimmed}.`);
				setUsername("");
				setShowInviteInput(false);
			}
		});
	}

	function handleCopyInviteLink() {
		startTransition(async () => {
			const result = await generateInviteAction(groupId);
			if ("error" in result) {
				toast(result.error);
				return;
			}
			const link = `${window.location.origin}/join/${result.token}`;
			try {
				await navigator.clipboard.writeText(link);
				toast("Invite link copied!");
			} catch {
				toast("Failed to copy link. Please try again.");
			}
		});
	}

	return (
		<div className="flex items-center gap-3 mb-6">
			{/* Invite by username */}
			{showInviteInput ? (
				<form onSubmit={handleInviteUser} className="flex items-center gap-2">
					<input
						type="text"
						value={username}
						onChange={(e) => {
							setUsername(e.target.value);
							setInviteError(null);
						}}
						placeholder="Username to invite..."
						className="font-mono text-xs bg-surface-container-low border border-outline-variant/20 rounded px-2 py-1 text-on-surface placeholder:text-on-surface-variant/50 outline-none focus:border-primary transition-colors"
					/>
					<button
						type="submit"
						disabled={isPending || !username.trim()}
						className="font-mono text-xs text-primary border border-primary px-2 py-0.5 rounded hover:bg-primary/10 transition-colors disabled:opacity-50"
					>
						[Send]
					</button>
					<button
						type="button"
						onClick={() => {
							setShowInviteInput(false);
							setInviteError(null);
							setUsername("");
						}}
						className="font-mono text-xs text-on-surface-variant hover:text-on-surface transition-colors"
					>
						[Cancel]
					</button>
					{inviteError && <span className="font-mono text-xs text-destructive">{inviteError}</span>}
				</form>
			) : (
				<button
					type="button"
					onClick={() => setShowInviteInput(true)}
					className="font-mono text-xs text-on-surface-variant hover:text-on-surface transition-colors"
				>
					[Invite member]
				</button>
			)}

			{/* Copy invite link */}
			<button
				type="button"
				onClick={handleCopyInviteLink}
				disabled={isPending}
				className="font-mono text-xs text-on-surface-variant hover:text-on-surface transition-colors disabled:opacity-50"
			>
				[Copy invite link]
			</button>
		</div>
	);
}
