"use client";

import { useState, useTransition } from "react";
import {
	AlertDialog,
	AlertDialogAction,
	AlertDialogCancel,
	AlertDialogContent,
	AlertDialogDescription,
	AlertDialogFooter,
	AlertDialogHeader,
	AlertDialogTitle,
	AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";
import { triggerReimport } from "@/actions/discogs";
import { toast } from "sonner";
import { useRouter } from "next/navigation";

interface ReimportDialogProps {
	disabled?: boolean;
}

/**
 * Confirmation dialog for reset and re-import (D-12).
 *
 * Per UI-SPEC:
 * - Title: "Reset and re-import?"
 * - Description: explains that current collection will be removed
 * - Dismiss: "Keep Collection" (outline)
 * - Confirm: "Re-import" (destructive)
 */
export function ReimportDialog({ disabled }: ReimportDialogProps) {
	const [open, setOpen] = useState(false);
	const [isPending, startTransition] = useTransition();
	const router = useRouter();

	const handleReimport = () => {
		startTransition(async () => {
			const result = await triggerReimport();

			if (result.error) {
				toast.error(result.error);
				return;
			}

			setOpen(false);

			if (result.redirectTo) {
				router.push(result.redirectTo);
			} else {
				router.push("/import-progress");
			}
		});
	};

	return (
		<AlertDialog open={open} onOpenChange={setOpen}>
			<AlertDialogTrigger
				render={
					<Button variant="destructive" size="sm" disabled={disabled}>
						Reset and re-import
					</Button>
				}
			/>
			<AlertDialogContent>
				<AlertDialogHeader>
					<AlertDialogTitle>Reset and re-import?</AlertDialogTitle>
					<AlertDialogDescription>
						This will remove your current imported collection and start a
						fresh import from Discogs.
					</AlertDialogDescription>
				</AlertDialogHeader>
				<AlertDialogFooter>
					<AlertDialogCancel disabled={isPending}>
						Keep Collection
					</AlertDialogCancel>
					<AlertDialogAction
						variant="destructive"
						onClick={handleReimport}
						disabled={isPending}
						aria-busy={isPending}
					>
						{isPending ? (
							<>
								<Loader2 className="mr-2 size-4 animate-spin" />
								Re-importing...
							</>
						) : (
							"Re-import"
						)}
					</AlertDialogAction>
				</AlertDialogFooter>
			</AlertDialogContent>
		</AlertDialog>
	);
}
