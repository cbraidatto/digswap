"use client";

import { toast } from "sonner";

interface ShareProfileButtonProps {
	username: string | null;
}

export function ShareProfileButton({ username }: ShareProfileButtonProps) {
	const url = `${typeof window !== "undefined" ? window.location.origin : ""}/u/${username}`;

	async function handleShare() {
		if (navigator.share) {
			try {
				await navigator.share({ title: `${username} on DigSwap`, url });
				return;
			} catch {
				// User cancelled or share failed, fall through to clipboard
			}
		}
		await navigator.clipboard.writeText(url);
		toast.success("Profile link copied!");
	}

	return (
		<button
			type="button"
			onClick={handleShare}
			className="flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-wider px-3 py-1.5 rounded border border-outline-variant/20 text-on-surface-variant hover:text-on-surface hover:border-outline-variant/40 transition-colors"
		>
			<span className="material-symbols-outlined text-[14px]">share</span>
			Share
		</button>
	);
}
