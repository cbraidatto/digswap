"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { toggleCrateVisibility } from "@/actions/crates";
import { Button } from "@/components/ui/button";

interface CrateHeaderActionsProps {
	crateId: string;
	crateTitle: string;
	initialIsPublic: boolean;
}

export function CrateHeaderActions({
	crateId,
	crateTitle,
	initialIsPublic,
}: CrateHeaderActionsProps) {
	const [isPublic, setIsPublic] = useState(initialIsPublic);
	const [isPending, startTransition] = useTransition();

	const handleToggle = () => {
		const next = !isPublic;
		startTransition(async () => {
			const result = await toggleCrateVisibility(crateId, next);
			if (result.success) {
				setIsPublic(next);
				toast.success(next ? "Crate is now public" : "Crate is now private");
			} else {
				toast.error(result.error ?? "Failed to update visibility");
			}
		});
	};

	const handleCopyLink = () => {
		const url = `${window.location.origin}/crates/${crateId}`;
		navigator.clipboard
			.writeText(url)
			.then(() => {
				toast.success("Link copied!");
			})
			.catch(() => {
				toast.error("Failed to copy link");
			});
	};

	return (
		<div className="flex items-center gap-2">
			<Button
				variant="outline"
				size="sm"
				onClick={handleToggle}
				disabled={isPending}
				className="font-mono text-xs uppercase tracking-wider"
			>
				{isPending ? (
					<span className="material-symbols-outlined text-sm animate-spin">progress_activity</span>
				) : isPublic ? (
					<>
						<span className="material-symbols-outlined text-sm mr-1">lock</span>
						Make private
					</>
				) : (
					<>
						<span className="material-symbols-outlined text-sm mr-1">lock_open</span>
						Make public
					</>
				)}
			</Button>

			{isPublic && (
				<Button
					variant="outline"
					size="sm"
					onClick={handleCopyLink}
					className="font-mono text-xs uppercase tracking-wider border-primary/30 text-primary hover:bg-primary/10"
				>
					<span className="material-symbols-outlined text-sm mr-1">share</span>
					Share
				</Button>
			)}
		</div>
	);
}
