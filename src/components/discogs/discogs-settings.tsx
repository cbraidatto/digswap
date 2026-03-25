"use client";

import { useTransition } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
	Card,
	CardAction,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { connectDiscogs, triggerSync } from "@/actions/discogs";
import { DisconnectDialog } from "@/components/discogs/disconnect-dialog";
import { ReimportDialog } from "@/components/discogs/reimport-dialog";

interface DiscogsSettingsProps {
	discogsConnected: boolean;
	discogsUsername: string | null;
	lastSyncedAt: string | null;
}

/**
 * Settings Discogs section card (D-02, D-13).
 *
 * Shows disconnected state with Connect CTA,
 * or connected state with username, sync status, and management actions.
 */
export function DiscogsSettings({
	discogsConnected,
	discogsUsername,
	lastSyncedAt,
}: DiscogsSettingsProps) {
	const [isConnecting, startConnectTransition] = useTransition();
	const [isSyncing, startSyncTransition] = useTransition();
	const router = useRouter();

	const handleConnect = () => {
		startConnectTransition(async () => {
			try {
				await connectDiscogs();
			} catch (error) {
				const message =
					error instanceof Error ? error.message : String(error);
				if (!message.includes("NEXT_REDIRECT")) {
					toast.error("Could not connect to Discogs. Please try again.");
				}
			}
		});
	};

	const handleSync = () => {
		startSyncTransition(async () => {
			const result = await triggerSync();

			if (result.error) {
				toast.info(result.error);
				return;
			}

			toast.success("Collection synced");
			router.refresh();
		});
	};

	const formattedLastSynced = lastSyncedAt
		? new Intl.DateTimeFormat("en-US", {
				dateStyle: "medium",
				timeStyle: "short",
			}).format(new Date(lastSyncedAt))
		: "Never";

	// Both destructive actions disabled during active sync
	const destructiveDisabled = isSyncing;

	if (!discogsConnected) {
		return (
			<Card>
				<CardHeader>
					<CardTitle>Discogs</CardTitle>
					<CardDescription>
						Connect your Discogs account to import your collection.
					</CardDescription>
				</CardHeader>
				<CardContent>
					<Button
						className="h-11 w-full"
						onClick={handleConnect}
						disabled={isConnecting}
					>
						{isConnecting ? (
							<>
								<Loader2 className="mr-2 size-4 animate-spin" />
								Connecting...
							</>
						) : (
							"Connect Discogs"
						)}
					</Button>
				</CardContent>
			</Card>
		);
	}

	return (
		<Card>
			<CardHeader>
				<CardTitle>Discogs</CardTitle>
				<CardAction>
					<Badge
						className="border-0"
						style={{
							background: "oklch(0.65 0.14 145 / 0.1)",
							color: "oklch(0.65 0.14 145)",
						}}
					>
						Connected
					</Badge>
				</CardAction>
			</CardHeader>
			<CardContent className="space-y-4">
				<div className="space-y-1">
					<p className="text-base text-foreground">
						@{discogsUsername}
					</p>
					<p className="text-sm text-muted-foreground">
						Last synced: {formattedLastSynced}
					</p>
				</div>

				<Button
					onClick={handleSync}
					disabled={isSyncing}
				>
					{isSyncing ? (
						<>
							<Loader2 className="mr-2 size-4 animate-spin" />
							Syncing...
						</>
					) : (
						"Sync Now"
					)}
				</Button>

				<Separator />

				<div className="flex flex-col gap-2">
					<ReimportDialog disabled={destructiveDisabled} />
					<DisconnectDialog disabled={destructiveDisabled} />
				</div>
			</CardContent>
		</Card>
	);
}
