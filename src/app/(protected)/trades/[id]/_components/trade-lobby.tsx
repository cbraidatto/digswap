"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";
import { usePeerConnection } from "@/lib/webrtc/use-peer-connection";
import {
	updateTradeStatus,
	cancelTrade,
	acceptTerms,
	declineTerms,
	updateLastJoinedLobby,
} from "@/actions/trades";
import { formatFileSize } from "@/lib/audio/file-metadata";
import { useReceivedFileStore, triggerBlobDownload } from "@/lib/webrtc/received-file-store";
import { TransferProgress } from "./transfer-progress";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type LobbyState =
	| "waiting_both"
	| "negotiation"
	| "preview_selection"
	| "previewing"
	| "preview_accepted"
	| "transferring"
	| "complete"
	| "failed"
	| "disconnected";

interface TradeLobbyProps {
	tradeId: string;
	userId: string;
	counterpartyId: string;
	role: "sender" | "receiver";
	iceServers: RTCIceServer[];
	counterpartyUsername: string;
	releaseTitle: string;
	offeringReleaseTitle: string | null;
	offeringReleaseArtist: string | null;
	declaredQuality: string | null;
	conditionNotes: string | null;
	termsAcceptedAt: string | null;
	termsAcceptedByRecipientAt: string | null;
	tradeStatus: string;
	fileName: string;
	fileSizeBytes: number;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function TradeLobby({
	tradeId,
	userId,
	counterpartyId,
	role,
	iceServers,
	counterpartyUsername,
	releaseTitle,
	offeringReleaseTitle,
	offeringReleaseArtist,
	declaredQuality,
	conditionNotes,
	termsAcceptedAt,
	termsAcceptedByRecipientAt,
	tradeStatus,
	fileName,
	fileSizeBytes,
}: TradeLobbyProps) {
	const router = useRouter();
	const [lobbyState, setLobbyState] = useState<LobbyState>("waiting_both");
	const [selectedFile, setSelectedFile] = useState<File | undefined>(undefined);
	const [cancelLoading, setCancelLoading] = useState(false);
	const [acceptingTerms, setAcceptingTerms] = useState(false);
	const [myTermsAccepted, setMyTermsAccepted] = useState(
		role === "sender" ? !!termsAcceptedByRecipientAt : !!termsAcceptedAt,
	);
	const [partnerOnline, setPartnerOnline] = useState(false);
	const [bothOnline, setBothOnline] = useState(false);
	const fileDownloadedRef = useRef(false);
	const setReceivedFile = useReceivedFileStore((s) => s.setFile);
	const presenceChannelRef = useRef<ReturnType<
		ReturnType<typeof createClient>["channel"]
	> | null>(null);

	// Initialize PeerJS connection hook
	const { state: peerState, sendFile, retry } = usePeerConnection(
		tradeId,
		userId,
		counterpartyId,
		role,
		iceServers,
		selectedFile,
	);

	// -----------------------------------------------------------------------
	// Initialize lobby state based on trade's current DB status (mount only)
	// -----------------------------------------------------------------------

	useEffect(() => {
		if (tradeStatus === "previewing") {
			setLobbyState("preview_selection");
		} else if (tradeStatus === "transferring") {
			setLobbyState("transferring");
		} else if (tradeStatus === "lobby") {
			// Check if both terms already accepted (page reload case)
			if (termsAcceptedAt && termsAcceptedByRecipientAt) {
				setLobbyState("preview_selection");
			}
			// else: waiting_both (default), will advance to negotiation when bothOnline
		}
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, []);

	// -----------------------------------------------------------------------
	// Supabase Realtime Presence: detect counterparty online status
	// -----------------------------------------------------------------------

	useEffect(() => {
		const supabase = createClient();
		const channel = supabase.channel(`trade:${tradeId}`, {
			config: { presence: { key: userId } },
		});

		channel
			.on("presence", { event: "sync" }, () => {
				const state = channel.presenceState();
				const onlineIds = Object.keys(state);
				const partnerIsHere = onlineIds.includes(counterpartyId);
				setPartnerOnline(partnerIsHere);
				setBothOnline(onlineIds.includes(userId) && partnerIsHere);
			})
			.on("presence", { event: "join" }, ({ key }) => {
				if (key === counterpartyId) {
					toast.success(`@${counterpartyUsername} is online`, { id: "partner-online" });
				}
			})
			.on("presence", { event: "leave" }, ({ key }) => {
				if (key === counterpartyId) {
					setPartnerOnline(false);
					setBothOnline(false);
					toast.info(`@${counterpartyUsername} left the lobby`, { id: "partner-offline" });
				}
			})
			.subscribe(async (status) => {
				if (status === "SUBSCRIBED") {
					await channel.track({ userId, joinedAt: new Date().toISOString() });
				}
			});

		presenceChannelRef.current = channel;

		// Audit: update lastJoinedLobbyAt
		updateLastJoinedLobby(tradeId);

		return () => {
			channel.unsubscribe();
		};
	}, [tradeId, userId, counterpartyId, counterpartyUsername]);

	// -----------------------------------------------------------------------
	// Postgres changes: detect DB status changes from counterparty actions
	// -----------------------------------------------------------------------

	useEffect(() => {
		const supabase = createClient();
		const dbChannel = supabase
			.channel(`trade-status:${tradeId}`)
			.on(
				"postgres_changes",
				{
					event: "UPDATE",
					schema: "public",
					table: "trade_requests",
					filter: `id=eq.${tradeId}`,
				},
				(payload) => {
					const newRow = payload.new as Record<string, unknown>;
					const newStatus = newRow.status as string;

					if (newStatus === "previewing" && lobbyState === "negotiation") {
						setLobbyState("preview_selection");
					} else if (newStatus === "transferring") {
						setLobbyState("transferring");
					} else if (newStatus === "declined" || newStatus === "cancelled") {
						setLobbyState("failed");
					}

					// Also check bilateral acceptance timestamps
					if (newRow.terms_accepted_at && newRow.terms_accepted_by_recipient_at) {
						setLobbyState("preview_selection");
					}
				},
			)
			.subscribe();

		return () => {
			dbChannel.unsubscribe();
		};
	}, [tradeId, lobbyState]);

	// -----------------------------------------------------------------------
	// State machine: advance from waiting_both -> negotiation when bothOnline
	// -----------------------------------------------------------------------

	useEffect(() => {
		if (lobbyState === "waiting_both" && bothOnline) {
			setLobbyState("negotiation");
		}
	}, [lobbyState, bothOnline]);

	// -----------------------------------------------------------------------
	// Sync peer state to lobby state (transferring / complete / failed / disconnected)
	// -----------------------------------------------------------------------

	useEffect(() => {
		if (peerState.status === "transferring") {
			setLobbyState("transferring");
		} else if (peerState.status === "complete") {
			setLobbyState("complete");
		} else if (peerState.status === "disconnected") {
			setLobbyState("disconnected");
		} else if (peerState.status === "failed") {
			setLobbyState("failed");
		}
	}, [peerState.status]);

	// -----------------------------------------------------------------------
	// Persist received file: trigger download + populate Zustand store
	// -----------------------------------------------------------------------

	useEffect(() => {
		if (
			peerState.status === "complete" &&
			peerState.receivedFile &&
			peerState.receivedFileName &&
			!fileDownloadedRef.current
		) {
			fileDownloadedRef.current = true;
			setReceivedFile(peerState.receivedFile, peerState.receivedFileName);
			triggerBlobDownload(peerState.receivedFile, peerState.receivedFileName);
		}
	}, [peerState.status, peerState.receivedFile, peerState.receivedFileName, setReceivedFile]);

	// -----------------------------------------------------------------------
	// Handle COMPLETE state: redirect to review page
	// -----------------------------------------------------------------------

	useEffect(() => {
		if (lobbyState === "complete") {
			updateTradeStatus(tradeId, "completed")
				.catch(() => {
					// Non-fatal
				})
				.finally(() => {
					router.push(`/trades/${tradeId}/complete`);
				});
		}
	}, [lobbyState, tradeId, router]);

	// -----------------------------------------------------------------------
	// Auto-send file when sender has file selected and peer is ready
	// -----------------------------------------------------------------------

	useEffect(() => {
		if (selectedFile && peerState.readyToSend) {
			sendFile();
		}
	}, [selectedFile, peerState.readyToSend, sendFile]);

	// -----------------------------------------------------------------------
	// Handlers
	// -----------------------------------------------------------------------

	const handleCancel = useCallback(async () => {
		setCancelLoading(true);
		try {
			await cancelTrade(tradeId);
			router.push("/trades");
		} catch {
			setCancelLoading(false);
		}
	}, [tradeId, router]);

	const handleFileSelect = useCallback(
		(e: React.ChangeEvent<HTMLInputElement>) => {
			const file = e.target.files?.[0];
			if (file) {
				setSelectedFile(file);
			}
		},
		[],
	);

	const handleRetry = useCallback(() => {
		setLobbyState("waiting_both");
		retry();
	}, [retry]);

	const handleAcceptTerms = useCallback(async () => {
		setAcceptingTerms(true);
		const result = await acceptTerms(tradeId);
		if (result.error) {
			toast.error(result.error);
		} else {
			setMyTermsAccepted(true);
			toast.success("Terms accepted");
			if (result.bothAccepted) {
				setLobbyState("preview_selection");
			}
		}
		setAcceptingTerms(false);
	}, [tradeId]);

	const handleDeclineTerms = useCallback(async () => {
		const result = await declineTerms(tradeId);
		if (result.error) {
			toast.error(result.error);
		} else {
			setLobbyState("failed");
			toast.info("Trade declined");
		}
	}, [tradeId]);

	// -----------------------------------------------------------------------
	// Render states
	// -----------------------------------------------------------------------

	return (
		<div aria-live="polite" className="space-y-6">
			{/* ---- BOTH_ONLINE banner (shown in negotiation+ states) ---- */}
			{bothOnline && lobbyState !== "waiting_both" && (
				<div className="w-full px-4 py-2 bg-primary/10 border border-primary/20 rounded-lg mb-4 text-center">
					<span className="text-[10px] font-mono text-primary tracking-[0.2em]">
						BOTH_ONLINE -- READY_TO_CONNECT
					</span>
				</div>
			)}

			{/* ---- WAITING_BOTH state ---- */}
			{lobbyState === "waiting_both" && (
				<div className="space-y-4 text-center">
					<span className="material-symbols-outlined text-tertiary text-5xl">
						hourglass_top
					</span>
					<h2 className="text-xl font-heading font-bold mt-4">WAITING_FOR_PARTNER</h2>
					<p className="text-sm text-on-surface-variant mt-2">
						Waiting for @{counterpartyUsername} to join the lobby...
					</p>
					{partnerOnline && (
						<div className="mt-4 px-4 py-2 bg-primary/10 border border-primary/20 rounded-lg inline-block">
							<span className="text-primary text-sm font-mono">PARTNER_ONLINE</span>
						</div>
					)}

					<div className="space-y-1 mt-4">
						<p className="text-[10px] font-mono text-on-surface-variant">
							TRADE: {releaseTitle}
						</p>
						<p className="text-[10px] font-mono text-on-surface-variant">
							WITH: @{counterpartyUsername}
						</p>
					</div>

					<button
						type="button"
						onClick={handleCancel}
						disabled={cancelLoading}
						className="mt-6 px-6 py-2 bg-surface-container-high text-on-surface text-sm font-mono rounded hover:bg-surface-bright transition-colors disabled:opacity-50"
					>
						CANCEL_TRADE
					</button>
				</div>
			)}

			{/* ---- NEGOTIATION state ---- */}
			{lobbyState === "negotiation" && (
				<div className="space-y-4">
					<h2 className="text-xl font-heading font-bold text-center">REVIEW_TRADE_TERMS</h2>
					<div className="grid grid-cols-1 md:grid-cols-2 gap-4">
						{/* Proposer's offer card */}
						<div className="bg-surface-container rounded-lg p-4 border border-outline-variant/10">
							<span className="text-[10px] font-mono text-on-surface-variant tracking-[0.2em]">
								OFFERING
							</span>
							<p className="font-heading font-bold mt-1">
								{offeringReleaseTitle ?? "Unknown Release"}
							</p>
							{offeringReleaseArtist && (
								<p className="text-xs text-on-surface-variant">{offeringReleaseArtist}</p>
							)}
							<div className="mt-3 space-y-1">
								{declaredQuality && (
									<p className="text-[10px] font-mono">QUALITY: {declaredQuality}</p>
								)}
								{conditionNotes && (
									<p className="text-[10px] font-mono">CONDITION: {conditionNotes}</p>
								)}
							</div>
						</div>
						{/* Requesting card */}
						<div className="bg-surface-container rounded-lg p-4 border border-outline-variant/10">
							<span className="text-[10px] font-mono text-on-surface-variant tracking-[0.2em]">
								REQUESTING
							</span>
							<p className="font-heading font-bold mt-1">{releaseTitle}</p>
						</div>
					</div>

					{/* Accept/Decline buttons */}
					<div className="flex gap-3 mt-6 justify-center">
						<button
							type="button"
							onClick={handleAcceptTerms}
							className="px-6 py-2 bg-primary text-on-primary text-sm font-mono rounded hover:opacity-90 transition-opacity disabled:opacity-50"
							disabled={acceptingTerms || myTermsAccepted}
						>
							{myTermsAccepted ? "TERMS_ACCEPTED" : "ACCEPT_TERMS"}
						</button>
						<button
							type="button"
							onClick={handleDeclineTerms}
							className="px-6 py-2 bg-surface-container-high text-on-surface text-sm font-mono rounded hover:bg-surface-bright transition-colors"
						>
							DECLINE
						</button>
					</div>

					{/* Status indicators */}
					{myTermsAccepted && (
						<p className="text-xs text-primary mt-2 text-center">
							You accepted. Waiting for @{counterpartyUsername}...
						</p>
					)}
				</div>
			)}

			{/* ---- PREVIEW_SELECTION state (placeholder for Plan 14-04) ---- */}
			{lobbyState === "preview_selection" && (
				<div className="text-center space-y-4">
					<span className="material-symbols-outlined text-secondary text-5xl">audio_file</span>
					<h2 className="text-xl font-heading font-bold mt-4">SELECT_FILES</h2>
					<p className="text-sm text-on-surface-variant mt-2">
						Both parties accepted terms. Select your audio file to generate a preview.
					</p>
					{/* File selection + SHA-256 + preview generation added in Plan 14-04 */}

					{!selectedFile && (
						<div className="mt-6 bg-surface-container-low rounded-lg p-4 border border-outline-variant/10">
							<p className="text-[10px] font-mono text-on-surface-variant mb-2">
								SELECT_YOUR_FILE_TO_SWAP:
							</p>
							<label className="inline-block px-4 py-2 bg-primary text-on-primary text-sm font-mono rounded cursor-pointer hover:opacity-90 transition-opacity">
								CHOOSE_FILE
								<input
									type="file"
									accept="audio/*"
									onChange={handleFileSelect}
									className="hidden"
								/>
							</label>
							<p className="text-[10px] font-mono text-on-surface-variant mt-2">
								EXPECTED: {fileName} ({formatFileSize(fileSizeBytes)})
							</p>
						</div>
					)}

					{selectedFile && (
						<div className="mt-4 bg-surface-container-low rounded-lg p-3 border border-primary/20">
							<p className="text-[10px] font-mono text-primary">
								FILE_READY: {selectedFile.name} ({formatFileSize(selectedFile.size)})
							</p>
						</div>
					)}
				</div>
			)}

			{/* ---- TRANSFERRING state (bidirectional) ---- */}
			{lobbyState === "transferring" && (
				<div className="space-y-4">
					<span className="material-symbols-outlined text-primary text-5xl">
						swap_horiz
					</span>
					<h1 className="text-3xl font-bold font-heading text-primary">
						SWAPPING
					</h1>
					{!selectedFile && (
						<div className="bg-surface-container-low rounded-lg p-4 border border-primary/40">
							<p className="text-[10px] font-mono text-primary mb-2">
								SELECT_YOUR_FILE_TO_SWAP:
							</p>
							<label className="inline-block px-4 py-2 bg-primary text-on-primary text-sm font-mono rounded cursor-pointer hover:opacity-90 transition-opacity">
								CHOOSE_FILE
								<input type="file" accept="audio/*" onChange={handleFileSelect} className="hidden" />
							</label>
						</div>
					)}

					{/* Upload direction: my file -> them */}
					<div className="space-y-1 text-left">
						<p className="text-[10px] font-mono text-on-surface-variant">UPLOAD (your file)</p>
						<TransferProgress
							progress={peerState.progress}
							bytesTransferred={peerState.bytesTransferred}
							totalBytes={peerState.totalBytes}
							speed={peerState.speed}
							eta={peerState.eta}
						/>
					</div>
					{/* Download direction: their file -> me */}
					<div className="space-y-1 text-left">
						<p className="text-[10px] font-mono text-on-surface-variant">DOWNLOAD (their file)</p>
						<TransferProgress
							progress={peerState.receiveProgress}
							bytesTransferred={peerState.bytesReceived}
							totalBytes={peerState.totalBytesToReceive}
							speed={0}
							eta={0}
						/>
					</div>
				</div>
			)}

			{/* ---- COMPLETE state (brief, before redirect) ---- */}
			{lobbyState === "complete" && (
				<div className="space-y-4">
					<span className="material-symbols-outlined text-primary text-5xl">
						check_circle
					</span>
					<h1 className="text-3xl font-bold font-heading text-primary">
						TRANSFER_COMPLETE
					</h1>
					<p className="text-sm text-on-surface-variant">
						Swap complete. File downloading. Redirecting...
					</p>
					{peerState.receivedFile && peerState.receivedFileName && (
						<button
							type="button"
							onClick={() => triggerBlobDownload(peerState.receivedFile!, peerState.receivedFileName!)}
							className="mt-4 px-6 py-2 bg-primary text-on-primary text-sm font-mono rounded hover:opacity-90 transition-opacity"
						>
							DOWNLOAD_AGAIN
						</button>
					)}
				</div>
			)}

			{/* ---- DISCONNECTED state (mid-transfer, recoverable) ---- */}
			{lobbyState === "disconnected" && (
				<div className="space-y-4">
					<span className="material-symbols-outlined text-warning text-5xl">
						wifi_off
					</span>
					<h1 className="text-3xl font-bold font-heading text-warning">
						CONNECTION_LOST
					</h1>
					<p className="text-sm text-on-surface-variant">
						The peer-to-peer connection was interrupted during transfer.
					</p>
					{peerState.error && (
						<p className="text-[10px] font-mono text-warning">
							{peerState.error}
						</p>
					)}
					{peerState.progress > 0 && (
						<div className="mt-2 space-y-1">
							<p className="text-[10px] font-mono text-on-surface-variant">
								PROGRESS_SAVED: {peerState.progress}%
							</p>
							<div className="w-full h-2 bg-surface-container-high rounded-full overflow-hidden">
								<div
									className="h-full bg-warning rounded-full transition-all"
									style={{ width: `${peerState.progress}%` }}
								/>
							</div>
							<p className="text-[10px] font-mono text-on-surface-variant">
								Transfer will resume from where it left off.
							</p>
						</div>
					)}

					<div className="flex items-center justify-center gap-4 mt-6">
						<button
							type="button"
							onClick={handleRetry}
							className="px-6 py-2 bg-primary text-on-primary text-sm font-mono rounded hover:opacity-90 transition-opacity"
						>
							RETRY_AND_RESUME
						</button>
						<button
							type="button"
							onClick={handleCancel}
							disabled={cancelLoading}
							className="px-6 py-2 bg-surface-container-high text-on-surface text-sm font-mono rounded hover:bg-surface-bright transition-colors disabled:opacity-50"
						>
							CANCEL_TRADE
						</button>
					</div>
				</div>
			)}

			{/* ---- FAILED state ---- */}
			{lobbyState === "failed" && (
				<div className="space-y-4">
					<span className="material-symbols-outlined text-destructive text-5xl">
						error_outline
					</span>
					<h1 className="text-3xl font-bold font-heading text-destructive">
						CONNECTION_FAILED
					</h1>
					<p className="text-sm text-on-surface-variant">
						The peer-to-peer connection was interrupted or the trade was declined.
					</p>
					{peerState.error && (
						<p className="text-[10px] font-mono text-destructive">
							ERROR: {peerState.error}
						</p>
					)}

					<div className="flex items-center justify-center gap-4 mt-6">
						<button
							type="button"
							onClick={handleRetry}
							className="px-6 py-2 bg-primary text-on-primary text-sm font-mono rounded hover:opacity-90 transition-opacity"
						>
							RETRY_CONNECTION
						</button>
						<button
							type="button"
							onClick={handleCancel}
							disabled={cancelLoading}
							className="px-6 py-2 bg-surface-container-high text-on-surface text-sm font-mono rounded hover:bg-surface-bright transition-colors disabled:opacity-50"
						>
							CANCEL_TRADE
						</button>
					</div>
				</div>
			)}
		</div>
	);
}
