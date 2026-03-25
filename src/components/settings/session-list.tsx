"use client";

import { useState, useEffect, useTransition } from "react";
import { Monitor, Smartphone, Globe, Clock, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { getSessions, terminateSession } from "@/actions/sessions";
import type { SessionInfo } from "@/actions/sessions";

/**
 * Maximum sessions allowed per user (D-13).
 * Displayed in the session count indicator.
 */
const MAX_SESSIONS = 3;

/**
 * Determine the appropriate device icon based on parsed device info.
 */
function DeviceIcon({ deviceInfo }: { deviceInfo: string }) {
	const isPhone =
		deviceInfo.includes("Android") || deviceInfo.includes("iOS");
	if (isPhone) {
		return <Smartphone className="h-5 w-5 text-muted-foreground" />;
	}
	return <Monitor className="h-5 w-5 text-muted-foreground" />;
}

/**
 * Format a date string into a relative time description.
 * E.g., "Just now", "5 minutes ago", "2 hours ago", "3 days ago"
 */
function formatRelativeTime(dateString: string): string {
	const date = new Date(dateString);
	const now = new Date();
	const diffMs = now.getTime() - date.getTime();
	const diffMinutes = Math.floor(diffMs / (1000 * 60));
	const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
	const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

	if (diffMinutes < 1) return "Just now";
	if (diffMinutes < 60) return `${diffMinutes} minute${diffMinutes === 1 ? "" : "s"} ago`;
	if (diffHours < 24) return `${diffHours} hour${diffHours === 1 ? "" : "s"} ago`;
	if (diffDays < 30) return `${diffDays} day${diffDays === 1 ? "" : "s"} ago`;
	return date.toLocaleDateString();
}

/**
 * Active sessions list with terminate buttons.
 *
 * Displays all active sessions for the current user with:
 * - Device info (parsed browser + OS)
 * - IP address
 * - Last seen time (relative)
 * - "Current session" badge for the active session
 * - "End Session" button for non-current sessions with inline confirmation
 * - Session count: "Active sessions: {count}/3" (per D-13)
 */
export function SessionList() {
	const [sessions, setSessions] = useState<SessionInfo[]>([]);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState<string | null>(null);
	const [confirmingId, setConfirmingId] = useState<string | null>(null);
	const [isPending, startTransition] = useTransition();

	// Fetch sessions on mount
	useEffect(() => {
		async function loadSessions() {
			const result = await getSessions();
			if (result.success) {
				setSessions(result.sessions);
			} else {
				setError(result.error || "Failed to load sessions");
			}
			setLoading(false);
		}
		loadSessions();
	}, []);

	/**
	 * Handle session termination with inline confirmation.
	 * First click shows confirmation, second click executes.
	 */
	function handleTerminate(sessionId: string) {
		if (confirmingId === sessionId) {
			// Second click -- execute termination
			startTransition(async () => {
				const result = await terminateSession(sessionId);
				if (result.success) {
					setSessions((prev) => prev.filter((s) => s.id !== sessionId));
				} else {
					setError(result.error || "Failed to terminate session");
				}
				setConfirmingId(null);
			});
		} else {
			// First click -- show confirmation
			setConfirmingId(sessionId);
		}
	}

	/**
	 * Cancel the inline confirmation.
	 */
	function handleCancelConfirm() {
		setConfirmingId(null);
	}

	if (loading) {
		return (
			<div className="space-y-3">
				<Skeleton className="h-20 w-full" />
				<Skeleton className="h-20 w-full" />
				<Skeleton className="h-20 w-full" />
			</div>
		);
	}

	if (error) {
		return (
			<div className="flex items-center gap-2 rounded-md border border-destructive/20 bg-destructive/5 p-4 text-sm text-destructive">
				<AlertCircle className="h-4 w-4 shrink-0" />
				<span>{error}</span>
			</div>
		);
	}

	return (
		<div className="space-y-4">
			{/* Session count indicator */}
			<div className="flex items-center justify-between">
				<p className="text-sm text-muted-foreground">
					Active sessions: {sessions.length}/{MAX_SESSIONS}
				</p>
			</div>

			{/* Session list */}
			{sessions.length === 0 ? (
				<p className="py-8 text-center text-sm text-muted-foreground">
					No active sessions found.
				</p>
			) : (
				<div className="space-y-3">
					{sessions.map((session) => (
						<Card
							key={session.id}
							className="border border-border bg-card"
						>
							<CardContent className="flex items-center justify-between gap-4 p-4">
								{/* Device info */}
								<div className="flex items-start gap-3">
									<div className="mt-0.5">
										<DeviceIcon deviceInfo={session.deviceInfo} />
									</div>
									<div className="space-y-1">
										<div className="flex items-center gap-2">
											<span className="text-sm font-medium text-card-foreground">
												{session.deviceInfo}
											</span>
											{session.isCurrent && (
												<Badge
													variant="secondary"
													className="text-xs"
												>
													Current session
												</Badge>
											)}
										</div>
										<div className="flex items-center gap-3 text-xs text-muted-foreground">
											<span className="flex items-center gap-1">
												<Globe className="h-3 w-3" />
												{session.ipAddress}
											</span>
											<span className="flex items-center gap-1">
												<Clock className="h-3 w-3" />
												{formatRelativeTime(session.lastSeenAt)}
											</span>
										</div>
									</div>
								</div>

								{/* Actions */}
								<div className="flex items-center gap-2 shrink-0">
									{!session.isCurrent && (
										<>
											{confirmingId === session.id ? (
												<div className="flex items-center gap-2">
													<span className="text-xs text-muted-foreground max-w-[140px] text-right">
														End this session? You will be signed out on
														that device.
													</span>
													<Button
														variant="destructive"
														size="sm"
														onClick={() => handleTerminate(session.id)}
														disabled={isPending}
													>
														{isPending ? "Ending..." : "Confirm"}
													</Button>
													<Button
														variant="ghost"
														size="sm"
														onClick={handleCancelConfirm}
														disabled={isPending}
													>
														Cancel
													</Button>
												</div>
											) : (
												<Button
													variant="outline"
													size="sm"
													className="text-destructive hover:bg-destructive/10 hover:text-destructive"
													onClick={() => handleTerminate(session.id)}
												>
													End Session
												</Button>
											)}
										</>
									)}
								</div>
							</CardContent>
						</Card>
					))}
				</div>
			)}
		</div>
	);
}
