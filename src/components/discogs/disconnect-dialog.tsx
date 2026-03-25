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
import { disconnectDiscogs } from "@/actions/discogs";
import { toast } from "sonner";
import { useRouter } from "next/navigation";

interface DisconnectDialogProps {
	disabled?: boolean;
}

/**
 * Confirmation dialog for disconnecting Discogs (D-15).
 *
 * Per UI-SPEC:
 * - Title: "Disconnect Discogs?"
 * - Description: explains that imported data will be removed
 * - Dismiss: "Keep Discogs" (outline)
 * - Confirm: "Disconnect" (destructive)
 */
export function DisconnectDialog({ disabled }: DisconnectDialogProps) {
	const [open, setOpen] = useState(false);
	const [isPending, startTransition] = useTransition();
	const router = useRouter();

	const handleDisconnect = () => {
		startTransition(async () => {
			const result = await disconnectDiscogs();

			if (result.error) {
				toast.error(result.error);
				return;
			}

			setOpen(false);
			toast.success("Discogs disconnected");
			router.refresh();
		});
	};

	return (
		<AlertDialog open={open} onOpenChange={setOpen}>
			<AlertDialogTrigger
				render={
					<Button variant="destructive" size="sm" disabled={disabled}>
						Disconnect Discogs
					</Button>
				}
			/>
			<AlertDialogContent>
				<AlertDialogHeader>
					<AlertDialogTitle>Disconnect Discogs?</AlertDialogTitle>
					<AlertDialogDescription>
						Your imported collection and wantlist will be removed from
						VinylDig. Records added manually will not be affected.
					</AlertDialogDescription>
				</AlertDialogHeader>
				<AlertDialogFooter>
					<AlertDialogCancel disabled={isPending}>
						Keep Discogs
					</AlertDialogCancel>
					<AlertDialogAction
						variant="destructive"
						onClick={handleDisconnect}
						disabled={isPending}
						aria-busy={isPending}
					>
						{isPending ? (
							<>
								<Loader2 className="mr-2 size-4 animate-spin" />
								Disconnecting...
							</>
						) : (
							"Disconnect"
						)}
					</AlertDialogAction>
				</AlertDialogFooter>
			</AlertDialogContent>
		</AlertDialog>
	);
}
