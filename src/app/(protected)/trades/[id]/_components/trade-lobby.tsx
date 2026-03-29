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
	acceptPreview,
	rejectPreview,
	updateFileHash,
} from "@/actions/trades";
import { formatFileSize } from "@/lib/audio/file-metadata";
import { useReceivedFileStore, triggerBlobDownload } from "@/lib/webrtc/received-file-store";
import { TransferProgress } from "./transfer-progress";
import { PreviewPlayer } from "./preview-player";
import { SpectrogramCanvas } from "../../review/_components/spectrogram-canvas";

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

	// Preview subsystem state (Plan 14-04)
	const [fileHash, setFileHash] = useState<string | null>(null);
	const [hashingProgress, setHashingProgress] = useState<"idle" | "computing" | "ready">("idle");
	const [fileDuration, setFileDuration] = useState<number | null>(null);
	const [estimatedBitrate, setEstimatedBitrate] = useState<number | null>(null);
	const [fileValidationError, setFileValidationError] = useState<string | null>(null);
	const [sendingPreview, setSendingPreview] = useState(false);
	const [acceptingPreview, setAcceptingPreview] = useState(false);
	const [myPreviewAccepted, setMyPreviewAccepted] = useState(false);
	const [showSpectrum, setShowSpectrum] = useState(false);
	const [spectrumAudioEl, setSpectrumAudioEl] = useState<HTMLAudioElement | null>(null);
	const presenceChannelRef = useRef<ReturnType<
		ReturnType<typeof createClient>["channel"]
	> | null>(null);

	// Initialize PeerJS connection hook
	const { state: peerState, sendFile, sendPreview: sendPreviewP2P, retry } = usePeerConnection(
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

	// SHA-256 Web Worker implementation (D-09)
	const computeFileHash = useCallback(
		async (file: File) => {
			setHashingProgress("computing");

			const workerScript = `
				self.onmessage = async (e) => {
					try {
						const buffer = e.data;
						const hashBuffer = await crypto.subtle.digest('SHA-256', buffer);
						const hashArray = Array.from(new Uint8Array(hashBuffer));
						const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
						self.postMessage({ hash: hashHex });
					} catch (err) {
						self.postMessage({ error: err.message });
					}
				};
			`;

			const blob = new Blob([workerScript], { type: "application/javascript" });
			const workerUrl = URL.createObjectURL(blob);
			const worker = new Worker(workerUrl);

			worker.onmessage = async (e: MessageEvent) => {
				URL.revokeObjectURL(workerUrl);
				worker.terminate();

				if (e.data.error) {
					toast.error("Hash computation failed");
					setHashingProgress("idle");
					return;
				}

				setFileHash(e.data.hash);
				setHashingProgress("ready");

				// Save hash to DB via server action
				await updateFileHash(tradeId, e.data.hash);
			};

			const arrayBuffer = await file.arrayBuffer();
			worker.postMessage(arrayBuffer, [arrayBuffer]);
		},
		[tradeId],
	);

	// File selection handler with duration validation (TRADE2-07: reject files < 1 minute)
	const handleFileSelect = useCallback(
		(e: React.ChangeEvent<HTMLInputElement>) => {
			const file = e.target.files?.[0];
			if (!file) return;

			setFileValidationError(null);

			// Check duration via <audio> element
			const url = URL.createObjectURL(file);
			const audio = new Audio();
			audio.preload = "metadata";

			audio.onloadedmetadata = () => {
				URL.revokeObjectURL(url);
				const duration = audio.duration;

				if (duration < 60) {
					setFileValidationError(
						`File is ${Math.round(duration)}s — minimum 1 minute required. Select a longer file.`,
					);
					return;
				}

				setFileDuration(duration);
				// Estimate bitrate: (file.size * 8) / duration (D-05)
				const bitrateKbps = Math.round((file.size * 8) / duration / 1000);
				setEstimatedBitrate(bitrateKbps);
				setSelectedFile(file);

				// Compute SHA-256 in Web Worker (D-09)
				computeFileHash(file);
			};

			audio.onerror = () => {
				URL.revokeObjectURL(url);
				setFileValidationError(
					"Could not read audio metadata. Make sure the file is a valid audio format.",
				);
			};

			audio.src = url;
		},
		[computeFileHash],
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
	// Preview send handler (D-03: first ~65s via Blob.slice)
	// -----------------------------------------------------------------------

	const handleSendPreview = useCallback(async () => {
		if (!selectedFile || !estimatedBitrate) return;
		setSendingPreview(true);

		// Generate preview: first ~65s of audio at estimated bitrate (D-03)
		const previewByteLength = Math.min(
			selectedFile.size,
			estimatedBitrate ? estimatedBitrate * 125 * 65 : 12_000_000,
		);
		const previewBlob = selectedFile.slice(0, previewByteLength);

		await sendPreviewP2P(previewBlob);
		setSendingPreview(false);

		// After sending, if we also received the other party's preview, advance to previewing
		if (peerState.previewReceived) {
			setLobbyState("previewing");
		}
	}, [selectedFile, estimatedBitrate, sendPreviewP2P, peerState.previewReceived]);

	// Auto-advance to previewing when both previews sent and received
	useEffect(() => {
		if (
			lobbyState === "preview_selection" &&
			peerState.previewReceived &&
			peerState.previewSendProgress === 100
		) {
			setLobbyState("previewing");
		}
	}, [lobbyState, peerState.previewReceived, peerState.previewSendProgress]);

	// -----------------------------------------------------------------------
	// Preview accept/reject handlers
	// -----------------------------------------------------------------------

	const handleAcceptPreview = useCallback(async () => {
		setAcceptingPreview(true);
		const result = await acceptPreview(tradeId);
		if (result.error) {
			toast.error(result.error);
		} else {
			setMyPreviewAccepted(true);
			toast.success("Preview accepted");
			if (result.bothAccepted) {
				setLobbyState("transferring");
				// Trigger full file transfer
				if (selectedFile) {
					sendFile();
				}
			}
		}
		setAcceptingPreview(false);
	}, [tradeId, selectedFile, sendFile]);

	const handleRejectPreview = useCallback(async () => {
		const result = await rejectPreview(tradeId);
		if (result.error) {
			toast.error(result.error);
		} else {
			setLobbyState("failed");
			toast.info("Preview rejected. Trade cancelled.");
		}
	}, [tradeId]);

	// -----------------------------------------------------------------------
	// Spectrum modal: create hidden <audio> from preview blob
	// -----------------------------------------------------------------------

	useEffect(() => {
		if (showSpectrum && peerState.previewReceived) {
			const url = URL.createObjectURL(peerState.previewReceived);
			const audio = new Audio(url);
			setSpectrumAudioEl(audio);
			return () => {
				URL.revokeObjectURL(url);
			};
		}
	}, [showSpectrum, peerState.previewReceived]);

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

			{/* ---- PREVIEW_SELECTION state ---- */}
			{lobbyState === "preview_selection" && (
				<div className="text-center space-y-4">
					<span className="material-symbols-outlined text-secondary text-5xl">audio_file</span>
					<h2 className="text-xl font-heading font-bold mt-4">SELECT_YOUR_FILE</h2>
					<p className="text-sm text-on-surface-variant mt-2">
						Select the audio file you are sharing. A 60-second preview will be generated.
					</p>

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

					{fileValidationError && (
						<p className="text-destructive text-sm mt-2">{fileValidationError}</p>
					)}

					{selectedFile && !fileValidationError && (
						<div className="mt-4 bg-surface-container rounded-lg p-4 border border-outline-variant/10 text-left">
							<p className="text-[10px] font-mono">FILE: {selectedFile.name}</p>
							<p className="text-[10px] font-mono">SIZE: {formatFileSize(selectedFile.size)}</p>
							<p className="text-[10px] font-mono">DURATION: {fileDuration ? `${Math.round(fileDuration)}s` : "—"}</p>
							<p className="text-[10px] font-mono">EST_BITRATE: ~{estimatedBitrate ?? "—"} kbps</p>
							<p className="text-[10px] font-mono">
								HASH:{" "}
								{hashingProgress === "computing"
									? "COMPUTING..."
									: hashingProgress === "ready"
										? `${fileHash?.slice(0, 16)}...`
										: "—"}
							</p>
						</div>
					)}

					{hashingProgress === "ready" && (
						<button
							type="button"
							onClick={handleSendPreview}
							disabled={sendingPreview}
							className="mt-4 px-6 py-2 bg-primary text-on-primary text-sm font-mono rounded hover:opacity-90 transition-opacity disabled:opacity-50"
						>
							{sendingPreview ? "SENDING..." : "SEND_PREVIEW"}
						</button>
					)}

					{/* Preview send/receive progress */}
					{sendingPreview && (
						<div className="mt-4">
							<p className="text-[10px] font-mono text-on-surface-variant">
								SENDING_PREVIEW: {peerState.previewSendProgress}%
							</p>
							<div className="w-full h-1 bg-surface-container-high rounded mt-1">
								<div
									className="h-1 bg-primary rounded transition-all"
									style={{ width: `${peerState.previewSendProgress}%` }}
								/>
							</div>
						</div>
					)}
					{peerState.previewReceiveProgress > 0 && peerState.previewReceiveProgress < 100 && (
						<div className="mt-4">
							<p className="text-[10px] font-mono text-on-surface-variant">
								RECEIVING_PREVIEW: {peerState.previewReceiveProgress}%
							</p>
							<div className="w-full h-1 bg-surface-container-high rounded mt-1">
								<div
									className="h-1 bg-secondary rounded transition-all"
									style={{ width: `${peerState.previewReceiveProgress}%` }}
								/>
							</div>
						</div>
					)}
				</div>
			)}

			{/* ---- PREVIEWING state ---- */}
			{lobbyState === "previewing" && (
				<div className="space-y-6">
					<h2 className="text-xl font-heading font-bold text-center">PREVIEW_PHASE</h2>
					<p className="text-sm text-on-surface-variant text-center">
						Listen to each other&apos;s previews. Accept or reject before the full transfer.
					</p>

					<div className="grid grid-cols-1 md:grid-cols-2 gap-6">
						{/* Partner's preview (received via P2P) */}
						{peerState.previewReceived && (
							<PreviewPlayer
								previewBlob={peerState.previewReceived}
								label={`${counterpartyUsername.toUpperCase()}'S_PREVIEW`}
								onAdvancedSpectrum={() => setShowSpectrum(true)}
							/>
						)}
						{/* My preview info (sent to partner) */}
						{selectedFile && (
							<div className="bg-surface-container rounded-lg p-4 border border-outline-variant/10">
								<span className="text-[10px] font-mono text-on-surface-variant tracking-[0.2em]">
									YOUR_PREVIEW_SENT
								</span>
								<p className="text-xs mt-2">{selectedFile.name}</p>
								<p className="text-[10px] font-mono text-on-surface-variant">
									Waiting for @{counterpartyUsername} to listen...
								</p>
							</div>
						)}
					</div>

					{/* Accept / Reject controls */}
					<div className="flex gap-3 justify-center mt-4">
						<button
							type="button"
							onClick={handleAcceptPreview}
							disabled={acceptingPreview || myPreviewAccepted}
							className="px-6 py-2 bg-primary text-on-primary text-sm font-mono rounded hover:opacity-90 transition-opacity disabled:opacity-50"
						>
							{myPreviewAccepted ? "PREVIEW_ACCEPTED" : "ACCEPT_PREVIEW"}
						</button>
						<button
							type="button"
							onClick={handleRejectPreview}
							className="px-6 py-2 bg-surface-container-high text-on-surface text-sm font-mono rounded hover:bg-surface-bright transition-colors"
						>
							REJECT_PREVIEW
						</button>
					</div>
					{myPreviewAccepted && (
						<p className="text-xs text-primary text-center">
							You accepted the preview. Waiting for @{counterpartyUsername}...
						</p>
					)}
				</div>
			)}

			{/* ---- SPECTRUM modal ---- */}
			{showSpectrum && spectrumAudioEl && (
				<div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
					<div className="bg-surface rounded-lg p-6 max-w-2xl w-full">
						<div className="flex justify-between items-center mb-4">
							<span className="text-[10px] font-mono text-on-surface-variant tracking-[0.2em]">
								ADVANCED_SPECTRUM
							</span>
							<button
								type="button"
								onClick={() => setShowSpectrum(false)}
								className="text-on-surface-variant hover:text-on-surface"
							>
								<span className="material-symbols-outlined">close</span>
							</button>
						</div>
						<div style={{ height: "300px" }}>
							<SpectrogramCanvas audioElement={spectrumAudioEl} isActive={showSpectrum} />
						</div>
					</div>
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
