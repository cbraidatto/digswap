"use client";



import { useEffect, useRef, useState, useCallback } from "react";

import { useRouter } from "next/navigation";

import { createClient } from "@/lib/supabase/client";

import { usePeerConnection } from "@/lib/webrtc/use-peer-connection";

import { updateTradeStatus, cancelTrade } from "@/actions/trades";

import { formatFileSize } from "@/lib/audio/file-metadata";

import { useReceivedFileStore, triggerBlobDownload } from "@/lib/webrtc/received-file-store";

import { TransferProgress } from "./transfer-progress";



// ---------------------------------------------------------------------------

// Types

// ---------------------------------------------------------------------------



type LobbyState =

	| "waiting"

	| "connecting"

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

	fileName,

	fileSizeBytes,

}: TradeLobbyProps) {

	const router = useRouter();

	const [lobbyState, setLobbyState] = useState<LobbyState>("waiting");

	const [selectedFile, setSelectedFile] = useState<File | undefined>(undefined);

	const [cancelLoading, setCancelLoading] = useState(false);

	const fileDownloadedRef = useRef(false);

	const setReceivedFile = useReceivedFileStore((s) => s.setFile);

	const channelRef = useRef<ReturnType<

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

	// Sync peer state to lobby state

	// -----------------------------------------------------------------------



	useEffect(() => {

		if (peerState.status === "connecting") {

			setLobbyState("connecting");

		} else if (peerState.status === "transferring") {

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

			// Save to Zustand store so review/spec-analysis page can access it

			setReceivedFile(peerState.receivedFile, peerState.receivedFileName);

			// Trigger browser file download — both sides receive the other's file

			triggerBlobDownload(peerState.receivedFile, peerState.receivedFileName);

		}

	}, [peerState.status, peerState.receivedFile, peerState.receivedFileName, setReceivedFile]);



	// -----------------------------------------------------------------------

	// Supabase Realtime: detect counterparty presence via status change

	// -----------------------------------------------------------------------



	useEffect(() => {

		const supabase = createClient();

		const channel = supabase

			.channel(`trade-lobby-${tradeId}`)

			.on(

				"postgres_changes",

				{

					event: "UPDATE",

					schema: "public",

					table: "trade_requests",

					filter: `id=eq.${tradeId}`,

				},

				(payload) => {

					const newStatus = (payload.new as { status: string }).status;



					if (

						newStatus === "transferring" &&

						lobbyState === "waiting"

					) {

						setLobbyState("connecting");

					} else if (newStatus === "completed") {

						setLobbyState("complete");

					} else if (

						newStatus === "cancelled" ||

						newStatus === "declined"

					) {

						setLobbyState("failed");

					}

				},

			)

			.subscribe();



		channelRef.current = channel;



		return () => {

			supabase.removeChannel(channel);

		};

	}, [tradeId, lobbyState]);



	// -----------------------------------------------------------------------

	// Handle CONNECTING state: update trade status to transferring

	// -----------------------------------------------------------------------



	useEffect(() => {

		if (lobbyState === "connecting" && role === "sender") {

			updateTradeStatus(tradeId, "transferring").catch(() => {

				// Non-fatal: status update failure shouldn't block connection

			});

		}

	}, [lobbyState, tradeId, role]);



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

		setLobbyState("waiting");

		retry(); // retry() now preserves chunks for resume

	}, [retry]);



	// -----------------------------------------------------------------------

	// Render states

	// -----------------------------------------------------------------------



	return (

		<div aria-live="polite" className="space-y-6">

			{/* ---- WAITING state ---- */}

			{lobbyState === "waiting" && (

				<div className="space-y-4">

					<span className="material-symbols-outlined text-tertiary text-5xl">

						hourglass_top

					</span>

					<h1 className="text-3xl font-bold font-heading">

						{peerState.connectionAttempts > 0 ? "CONNECTING..." : "WAITING_FOR_PEER"}

					</h1>

					<p className="text-sm text-on-surface-variant">

						{peerState.connectionAttempts > 0
							? `Establishing peer connection... (attempt ${peerState.connectionAttempts + 1}/11)`
							: "Waiting for counterparty to join the lobby..."}

					</p>

					<span className="blink inline-block w-3 h-5 bg-on-surface" />



					<div className="space-y-1 mt-4">

						<p className="text-[10px] font-mono text-on-surface-variant">

							TRADE: {releaseTitle}

						</p>

						<p className="text-[10px] font-mono text-on-surface-variant">

							WITH: @{counterpartyUsername}

						</p>

					</div>



					{/* Both users must select their file to send */}

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



			{/* ---- CONNECTING state ---- */}

			{lobbyState === "connecting" && (

				<div className="space-y-4">

					<span className="material-symbols-outlined text-secondary text-5xl">

						lan

					</span>

					<h1 className="text-3xl font-bold font-heading text-secondary">

						[ESTABLISHING_CONNECTION...]

					</h1>

					<p className="text-sm text-on-surface-variant">

						Setting up secure peer-to-peer channel.

					</p>

					<div className="flex items-center justify-center gap-1 mt-2">

						<span

							className="w-2 h-2 bg-secondary rounded-full animate-pulse"

							style={{ animationDelay: "0ms" }}

						/>

						<span

							className="w-2 h-2 bg-secondary rounded-full animate-pulse"

							style={{ animationDelay: "200ms" }}

						/>

						<span

							className="w-2 h-2 bg-secondary rounded-full animate-pulse"

							style={{ animationDelay: "400ms" }}

						/>

					</div>



					{!selectedFile && (

						<div className="mt-4 bg-surface-container-low rounded-lg p-4 border border-secondary/20">

							<p className="text-[10px] font-mono text-secondary mb-2">

								SELECT_YOUR_FILE_TO_SWAP:

							</p>

							<label className="inline-block px-4 py-2 bg-primary text-on-primary text-sm font-mono rounded cursor-pointer hover:opacity-90 transition-opacity">

								CHOOSE_FILE

								<input type="file" accept="audio/*" onChange={handleFileSelect} className="hidden" />

							</label>

						</div>

					)}

					{selectedFile && (

						<p className="text-[10px] font-mono text-primary mt-2">

							FILE_READY: {selectedFile.name}

						</p>

					)}

				</div>

			)}



			{/* ---- TRANSFERRING state (bidirectional — both upload & download simultaneously) ---- */}

			{lobbyState === "transferring" && (

				<div className="space-y-4">

					<span className="material-symbols-outlined text-primary text-5xl">

						swap_horiz

					</span>

					<h1 className="text-3xl font-bold font-heading text-primary">

						SWAPPING

					</h1>

					{/* File picker: must remain visible if user hasn't selected yet (receiving can start before they pick) */}
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

					{/* Upload direction: my file → them */}
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

					{/* Download direction: their file → me */}
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

						The peer-to-peer connection was interrupted.

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

