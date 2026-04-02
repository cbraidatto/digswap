"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { acceptInviteAction } from "@/actions/community";
import { toast } from "sonner";

interface InviteAcceptButtonProps {
	token: string;
	groupName: string;
	groupSlug: string;
}

export function InviteAcceptButton({
	token,
	groupName,
	groupSlug,
}: InviteAcceptButtonProps) {
	const router = useRouter();
	const [isPending, startTransition] = useTransition();

	function handleAccept() {
		startTransition(async () => {
			const result = await acceptInviteAction(token);

			if ("error" in result) {
				toast(result.error);
				return;
			}

			toast(`Joined ${groupName}!`);
			router.push(`/comunidade/${result.slug}`);
		});
	}

	return (
		<button
			type="button"
			onClick={handleAccept}
			disabled={isPending}
			className="font-mono text-xs bg-primary text-primary-foreground px-6 py-2 rounded hover:bg-primary/90 transition-colors disabled:opacity-50"
		>
			{isPending ? "Joining..." : "[Join Group]"}
		</button>
	);
}
