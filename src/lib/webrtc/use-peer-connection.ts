"use client";

import type { DataConnection } from "peerjs";
import Peer from "peerjs";
import { useCallback, useEffect, useRef, useState } from "react";
import {
	ACK_INTERVAL,
	CHUNK_SIZE,
	calculateTransferStats,
	highestContiguousChunk,
	isValidChunkIndex,
	reassembleChunks,
	sliceFileIntoChunks,
	type TransferMessage,
} from "./chunked-transfer";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface PeerState {
	status:
		| "idle"
		| "waiting"
		| "connecting"
		| "transferring"
		| "complete"
		| "failed"
		| "disconnected";
	// Send direction (my file → them)
	progress: number; // 0-100
	bytesTransferred: number;
	totalBytes: number;
	speed: number; // bytes/sec
	eta: number; // seconds remaining
	// Receive direction (their file → me)
	receiveProgress: number; // 0-100
	bytesReceived: number;
	totalBytesToReceive: number;
	// Preview (Plan 14-04)
	previewReceived: Blob | null;
	previewSendProgress: number; // 0-100
	previewReceiveProgress: number; // 0-100
	// Outcome
	error: string | null;
	receivedFile: Blob | null;
	receivedFileName: string | null;
	/** True once the peer has sent us their resume-request (we know where to start sending) */
	readyToSend: boolean;
	/** Number of peer-unavailable retries attempted so far (for UI feedback) */
	connectionAttempts: number;
}

const INITIAL_STATE: PeerState = {
	status: "idle",
	progress: 0,
	bytesTransferred: 0,
	totalBytes: 0,
	speed: 0,
	eta: 0,
	receiveProgress: 0,
	bytesReceived: 0,
	totalBytesToReceive: 0,
	previewReceived: null,
	previewSendProgress: 0,
	previewReceiveProgress: 0,
	error: null,
	receivedFile: null,
	receivedFileName: null,
	readyToSend: false,
	connectionAttempts: 0,
};

// Max buffered amount before pausing sends
const MAX_BUFFERED_AMOUNT = 1_048_576; // 1MB — pause sending when buffer exceeds this (D-08)

// Throttle progress updates to every 100ms
const PROGRESS_THROTTLE_MS = 100;

// How long to wait for receiver-complete ACK after sending "done" message
const COMPLETION_ACK_TIMEOUT_MS = 15_000;

// ---------------------------------------------------------------------------
// Helper: build deterministic peer ID
// ---------------------------------------------------------------------------

function buildPeerId(tradeId: string, odUserId: string): string {
	return `digswap-${tradeId}-${odUserId.substring(0, 8)}`;
}

// ---------------------------------------------------------------------------
// Hook
//
// role: "sender" | "receiver" controls only WHO INITIATES the WebRTC connection.
//   "sender" (provider)  → calls peer.connect() to the other side
//   "receiver" (requester) → waits for peer.on("connection")
//
// Both sides send AND receive a file simultaneously (bidirectional swap).
// ---------------------------------------------------------------------------

export function usePeerConnection(
	tradeId: string,
	userId: string,
	counterpartyId: string,
	role: "sender" | "receiver",
	iceServers: RTCIceServer[],
	file?: File,
): {
	state: PeerState;
	sendFile: () => Promise<void>;
	sendPreview: (previewBlob: Blob) => Promise<void>;
	retry: () => void;
	cleanup: () => void;
} {
	const [state, setState] = useState<PeerState>(INITIAL_STATE);
	const peerRef = useRef<Peer | null>(null);
	const connRef = useRef<DataConnection | null>(null);

	// Received chunks from the OTHER peer (their file coming to us)
	const chunksRef = useRef<ArrayBuffer[]>([]);
	// Preview chunks buffer (Plan 14-04)
	const previewChunksRef = useRef<ArrayBuffer[] | null>(null);
	// Transfer timers
	const sendStartTimeRef = useRef<number>(0);
	const receiveStartTimeRef = useRef<number>(0);
	const lastSendProgressUpdateRef = useRef<number>(0);
	const lastReceiveProgressUpdateRef = useRef<number>(0);

	const retryTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

	// Track whether we had an active transfer before disconnect (for resume detection)
	const hadActiveTransferRef = useRef(false);
	// Total chunks expected from the other peer (learned from first chunk or resume-response)
	const totalChunksExpectedRef = useRef(0);
	// Last ACK'd chunk index that the OTHER peer confirmed receiving from us
	const lastAckedIndexRef = useRef(-1);
	// Resume-from index for OUR send (set when we receive their resume-request)
	const resumeFromRef = useRef(0);
	// Completion tracking — both directions must complete before status = "complete"
	const sendCompleteRef = useRef(false);
	const receiveCompleteRef = useRef(false);
	// Completion ACK timeout (we wait for peer to confirm receipt of our file)
	const completionTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
	// Tracks "unavailable-id" retry attempts when re-registering with signaling server
	const retryCountRef = useRef(0);
	// Per-connection ICE timeout — fires if conn.on("open") doesn't arrive within 20s
	const iceTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

	// -----------------------------------------------------------------------
	// Helper: check if BOTH directions are complete → set status = "complete"
	// -----------------------------------------------------------------------

	const checkBothComplete = useCallback(() => {
		if (sendCompleteRef.current && receiveCompleteRef.current) {
			if (completionTimeoutRef.current) {
				clearTimeout(completionTimeoutRef.current);
				completionTimeoutRef.current = null;
			}
			setState((prev) => {
				if (prev.status === "complete") return prev;
				return { ...prev, status: "complete", progress: 100, receiveProgress: 100 };
			});
		}
	}, []);

	// -----------------------------------------------------------------------
	// Setup data connection listeners (defined first - used by initPeer)
	// Both sides send AND receive — role only governs connection initiation.
	// -----------------------------------------------------------------------

	const setupDataConnection = useCallback(
		(conn: DataConnection) => {
			// ICE negotiation timeout: if the data channel doesn't open within 20s,
			// close this connection attempt so the caller can retry or fail.
			if (iceTimeoutRef.current) clearTimeout(iceTimeoutRef.current);
			iceTimeoutRef.current = setTimeout(() => {
				if (connRef.current === conn) {
					try { conn.close(); } catch { /* ignore */ }
					connRef.current = null;
					setState((prev) => {
						if (prev.status === "waiting" || prev.status === "connecting") {
							return {
								...prev,
								status: hadActiveTransferRef.current ? "disconnected" : "failed",
								error: "Connection timed out. Click RETRY to try again.",
							};
						}
						return prev;
					});
				}
			}, 20_000);

			conn.on("open", () => {
				// Clear ICE timeout — channel opened successfully
				if (iceTimeoutRef.current) {
					clearTimeout(iceTimeoutRef.current);
					iceTimeoutRef.current = null;
				}
				setState((prev) => ({ ...prev, status: "connecting" }));

				// BOTH sides send resume-request, indicating where their receive progress is.
				// This tells the other side where to START sending their file from.
				const existingChunks = chunksRef.current;
				const lastContiguous = highestContiguousChunk(existingChunks);

				if (hadActiveTransferRef.current && lastContiguous >= 0) {
					// We have partial data from a previous connection — request resume
					const resumeReq: TransferMessage = {
						type: "resume-request",
						lastReceivedIndex: lastContiguous,
						totalExpected: totalChunksExpectedRef.current,
					};
					conn.send(resumeReq);
					receiveStartTimeRef.current = Date.now();
				} else {
					// Fresh receive — reset chunk buffer
					chunksRef.current = [];
					receiveStartTimeRef.current = Date.now();
					const resumeReq: TransferMessage = {
						type: "resume-request",
						lastReceivedIndex: -1,
						totalExpected: 0,
					};
					conn.send(resumeReq);
				}
			});

			conn.on("data", (rawData: unknown) => {
				const data = rawData as TransferMessage;

				// ---- RECEIVING their file (incoming chunks) ----
				if (data.type === "chunk") {
					if (!isValidChunkIndex(data.index, data.total)) {
						console.warn(`[P2P] Invalid chunk index ${data.index}/${data.total} — ignoring`);
						return;
					}
					// Start receive timer on first chunk
					if (receiveStartTimeRef.current === 0) {
						receiveStartTimeRef.current = Date.now();
					}
					chunksRef.current[data.index] = data.data;
					totalChunksExpectedRef.current = data.total;
					hadActiveTransferRef.current = true;

					const bytesReceived = chunksRef.current.reduce(
						(sum, chunk) => sum + (chunk?.byteLength ?? 0),
						0,
					);
					const totalBytesToReceive = data.total * CHUNK_SIZE;

					// ACK every ACK_INTERVAL chunks so sender can track progress
					if ((data.index + 1) % ACK_INTERVAL === 0 || data.index === data.total - 1) {
						const ack: TransferMessage = { type: "ack", lastReceivedIndex: data.index };
						try { conn.send(ack); } catch { /* non-fatal */ }
					}

					// Throttle receive progress updates
					const now = Date.now();
					if (now - lastReceiveProgressUpdateRef.current >= PROGRESS_THROTTLE_MS) {
						lastReceiveProgressUpdateRef.current = now;
						const stats = calculateTransferStats(
							bytesReceived,
							totalBytesToReceive,
							receiveStartTimeRef.current,
						);
						setState((prev) => ({
							...prev,
							status: "transferring",
							bytesReceived,
							totalBytesToReceive,
							receiveProgress: stats.progress,
						}));
					}
				}

				else if (data.type === "done") {
					// Other side finished sending their file — verify we have all chunks
					const totalExpected = totalChunksExpectedRef.current;
					let allReceived = totalExpected > 0;
					for (let i = 0; i < totalExpected && allReceived; i++) {
						if (!chunksRef.current[i]) allReceived = false;
					}

					if (allReceived && totalExpected > 0) {
						const blob = reassembleChunks(chunksRef.current, data.fileName);
						receiveCompleteRef.current = true;

						// Send confirmation back so they know we got it
						const confirmMsg: TransferMessage = { type: "receiver-complete" };
						try { conn.send(confirmMsg); } catch { /* non-fatal */ }

						setState((prev) => ({
							...prev,
							receiveProgress: 100,
							bytesReceived: data.fileSize,
							totalBytesToReceive: data.fileSize,
							receivedFile: blob,
							receivedFileName: data.fileName,
						}));

						checkBothComplete();
					} else {
						// Missing chunks — disconnected mid-transfer
						console.warn(
							`[P2P] Received "done" but missing chunks. Expected ${totalExpected}, have up to ${highestContiguousChunk(chunksRef.current)}`,
						);
						setState((prev) => ({
							...prev,
							status: "disconnected",
							error: `Transfer incomplete: ${highestContiguousChunk(chunksRef.current) + 1}/${totalExpected} chunks received. Retry to resume.`,
						}));
					}
				}

				else if (data.type === "resume-response") {
					// They're telling us where they're resuming receive from
					// (i.e., where to start sending our file)
					totalChunksExpectedRef.current = data.totalChunks;
					const bytesReceived = data.resumeFromIndex * CHUNK_SIZE;
					const stats = calculateTransferStats(
						bytesReceived,
						data.fileSize,
						receiveStartTimeRef.current || Date.now(),
					);
					setState((prev) => ({
						...prev,
						bytesReceived,
						totalBytesToReceive: data.fileSize,
						receiveProgress: stats.progress,
					}));
				}

				// ---- SENDING our file (outbound flow control messages) ----
				else if (data.type === "ack") {
					// They acknowledged receipt of our chunks up to this index
					lastAckedIndexRef.current = Math.max(lastAckedIndexRef.current, data.lastReceivedIndex);
				}

				else if (data.type === "resume-request") {
					// They're telling us where THEIR receive is — this is where we start sending
					resumeFromRef.current = data.lastReceivedIndex + 1;
					setState((prev) => ({ ...prev, readyToSend: true }));
				}

				else if (data.type === "receiver-complete") {
					// They confirmed full receipt of OUR file
					if (completionTimeoutRef.current) {
						clearTimeout(completionTimeoutRef.current);
						completionTimeoutRef.current = null;
					}
					sendCompleteRef.current = true;
					setState((prev) => ({
						...prev,
						progress: 100,
						bytesTransferred: prev.totalBytes,
					}));
					checkBothComplete();
				}

				// ---- PREVIEW transfer messages (Plan 14-04) ----
				else if (data.type === "preview-chunk") {
					const msg = data as { type: "preview-chunk"; index: number; total: number; data: ArrayBuffer };
					if (!previewChunksRef.current) {
						previewChunksRef.current = new Array(msg.total);
					}
					previewChunksRef.current[msg.index] = msg.data;
					setState((prev) => ({
						...prev,
						previewReceiveProgress: Math.round(((msg.index + 1) / msg.total) * 100),
					}));
				}

				else if (data.type === "preview-done") {
					// Reassemble preview
					const chunks = previewChunksRef.current;
					if (chunks) {
						const blob = new Blob(chunks.filter(Boolean));
						setState((prev) => ({ ...prev, previewReceived: blob, previewReceiveProgress: 100 }));
					}
				}
			});

			conn.on("close", () => {
				setState((prev) => {
					if (prev.status === "complete") return prev;
					if (prev.status === "transferring" || hadActiveTransferRef.current) {
						return {
							...prev,
							status: "disconnected",
							error: "Connection lost during transfer. Click RETRY to resume.",
						};
					}
					return { ...prev, status: "failed", error: "Connection closed unexpectedly" };
				});
			});

			conn.on("error", (err) => {
				setState((prev) => {
					if (prev.status === "complete") return prev;
					if (prev.status === "transferring" || hadActiveTransferRef.current) {
						return {
							...prev,
							status: "disconnected",
							error: "Connection error during transfer. Click RETRY to resume.",
						};
					}
					return { ...prev, status: "failed", error: err.message || "Data channel error" };
				});
			});
		},
		[checkBothComplete], // role removed — data handling is now symmetric
	);

	// -----------------------------------------------------------------------
	// Initialize peer
	// -----------------------------------------------------------------------

	const initPeer = useCallback(() => {
		if (retryTimeoutRef.current) { clearTimeout(retryTimeoutRef.current); retryTimeoutRef.current = null; }
		if (completionTimeoutRef.current) { clearTimeout(completionTimeoutRef.current); completionTimeoutRef.current = null; }
		if (iceTimeoutRef.current) { clearTimeout(iceTimeoutRef.current); iceTimeoutRef.current = null; }
		if (peerRef.current) { peerRef.current.destroy(); }

		setState((prev) => {
			if (prev.status === "disconnected") return { ...prev, status: "idle", error: null };
			return { ...INITIAL_STATE, status: "idle" };
		});

		const peerId = buildPeerId(tradeId, userId);
		const peer = new Peer(peerId, { config: { iceServers }, debug: 0 });
		peerRef.current = peer;

		peer.on("open", (_id) => {
			setState((prev) => ({ ...prev, status: "waiting" }));

			// role === "sender" (provider) initiates the DataConnection
			if (role === "sender") {
				const receiverPeerId = buildPeerId(tradeId, counterpartyId);
				let retryCount = 0;
				const MAX_RETRIES = 10;
				const RETRY_DELAY_MS = 2000;

				const attemptConnect = () => {
					if (!peerRef.current || peerRef.current.destroyed || retryCount >= MAX_RETRIES) {
						setState((prev) => ({
							...prev,
							status: hadActiveTransferRef.current ? "disconnected" : "failed",
							error: "Peer not available after maximum retries. Click RETRY to try again.",
						}));
						return;
					}
					const conn = peer.connect(receiverPeerId, { reliable: true });
					connRef.current = conn;
					setupDataConnection(conn);
				};

				const onPeerError = (err: { type?: string; message?: string }) => {
					if (err.type === "peer-unavailable") {
						if (retryCount < MAX_RETRIES) {
							retryCount++;
							setState((prev) => ({ ...prev, connectionAttempts: retryCount }));
							retryTimeoutRef.current = setTimeout(attemptConnect, RETRY_DELAY_MS);
						} else {
							peer.off("error", onPeerError as Parameters<typeof peer.on>[1]);
							setState((prev) => ({
								...prev,
								status: hadActiveTransferRef.current ? "disconnected" : "failed",
								error: "Peer not available after maximum retries. Click RETRY to try again.",
							}));
						}
					} else {
						peer.off("error", onPeerError as Parameters<typeof peer.on>[1]);
						setState((prev) => ({
							...prev,
							status: hadActiveTransferRef.current ? "disconnected" : "failed",
							error: err.message || "Peer connection error",
						}));
					}
				};

				peer.on("error", onPeerError as Parameters<typeof peer.on>[1]);
				attemptConnect();
			}
		});

		peer.on("error", (err) => {
			const e = err as { type?: string; message?: string };

			if (e.type === "unavailable-id") {
				retryCountRef.current += 1;
				if (retryCountRef.current > 5) {
					setState((prev) => ({
						...prev,
						status: hadActiveTransferRef.current ? "disconnected" : "failed",
						error: "Could not register with signaling server. Please refresh the page.",
					}));
					return;
				}
				peer.destroy();
				peerRef.current = null;
				retryTimeoutRef.current = setTimeout(() => { initPeer(); }, 2000);
				return;
			}

			if (e.type === "peer-unavailable") {
				// Handled by the per-connection onPeerError above; only care for receiver role
				if (role === "receiver" && hadActiveTransferRef.current) {
					setState((prev) => {
						if (prev.status === "complete") return prev;
						return {
							...prev,
							status: "disconnected",
							error: "Peer disconnected. Click RETRY to reconnect and resume.",
						};
					});
				}
				return;
			}

			setState((prev) => {
				if (prev.status === "complete") return prev;
				if (hadActiveTransferRef.current) {
					return { ...prev, status: "disconnected", error: e.message || "Connection error. Click RETRY to resume." };
				}
				return { ...prev, status: "failed", error: e.message || "Peer connection error" };
			});
		});

		peer.on("disconnected", () => {
			setState((prev) => {
				if (prev.status === "complete") return prev;
				if (prev.status === "transferring" || hadActiveTransferRef.current) {
					return { ...prev, status: "disconnected", error: "Lost connection to signaling server. Click RETRY to reconnect." };
				}
				if (peerRef.current && !peerRef.current.destroyed) peerRef.current.reconnect();
				return prev;
			});
		});

		// role === "receiver" (requester) accepts the DataConnection
		peer.on("connection", (conn) => {
			connRef.current = conn;
			setState((prev) => ({ ...prev, status: "connecting" }));
			setupDataConnection(conn);
		});
	}, [tradeId, userId, counterpartyId, role, iceServers, setupDataConnection]); // eslint-disable-line react-hooks/exhaustive-deps

	// -----------------------------------------------------------------------
	// Send file — both roles can send (bidirectional swap)
	// -----------------------------------------------------------------------

	const sendFile = useCallback(async () => {
		if (!file) return;

		const conn = connRef.current;
		if (!conn) {
			setState((prev) => ({ ...prev, status: "failed", error: "No connection established" }));
			return;
		}

		setState((prev) => ({ ...prev, status: "transferring", readyToSend: false }));
		sendStartTimeRef.current = Date.now();
		hadActiveTransferRef.current = true;

		const { totalChunks, getChunk } = sliceFileIntoChunks(file);
		const startFrom = resumeFromRef.current;

		// If resuming, tell the other side where we're starting from
		if (startFrom > 0) {
			const resumeResp: TransferMessage = {
				type: "resume-response",
				resumeFromIndex: startFrom,
				totalChunks,
				fileName: file.name,
				fileSize: file.size,
			};
			conn.send(resumeResp);
		}

		try {
			for (let i = startFrom; i < totalChunks; i++) {
				const chunkData = await getChunk(i);

				// Flow control: pause if buffer is full
				const dc = (conn as unknown as { _dc?: RTCDataChannel })._dc;
				if (dc && dc.bufferedAmount > MAX_BUFFERED_AMOUNT) {
					await new Promise<void>((resolve) => {
						const onLow = () => { dc.removeEventListener("bufferedamountlow", onLow); resolve(); };
						dc.bufferedAmountLowThreshold = 262_144; // 256KB — resume sending when buffer drains to this (D-08)
						dc.addEventListener("bufferedamountlow", onLow);
					});
				}

				conn.send({ type: "chunk", index: i, total: totalChunks, data: chunkData } as TransferMessage);

				// Throttle send progress updates
				const now = Date.now();
				if (now - lastSendProgressUpdateRef.current >= PROGRESS_THROTTLE_MS) {
					lastSendProgressUpdateRef.current = now;
					const bytesTransferred = (i + 1) * CHUNK_SIZE;
					const stats = calculateTransferStats(bytesTransferred, file.size, sendStartTimeRef.current);
					setState((prev) => ({
						...prev,
						bytesTransferred,
						totalBytes: file.size,
						progress: stats.progress,
						speed: stats.speed,
						eta: stats.eta,
					}));
				}
			}

			// All chunks sent — send "done" and wait for receiver-complete
			conn.send({ type: "done", fileName: file.name, fileSize: file.size } as TransferMessage);

			setState((prev) => ({
				...prev,
				progress: 99, // 99% until they confirm
				bytesTransferred: file.size,
				totalBytes: file.size,
			}));

			// Timeout fallback in case receiver-complete never arrives
			completionTimeoutRef.current = setTimeout(() => {
				if (sendCompleteRef.current) return;
				sendCompleteRef.current = true;
				setState((prev) => {
					if (prev.status === "complete") return prev;
					return { ...prev, progress: 100, bytesTransferred: file.size, totalBytes: file.size };
				});
				checkBothComplete();
			}, COMPLETION_ACK_TIMEOUT_MS);

		} catch (err) {
			setState((prev) => ({
				...prev,
				status: "disconnected",
				error: err instanceof Error ? err.message : "Transfer interrupted. Click RETRY to resume.",
			}));
		}
	}, [file, checkBothComplete]);

	// -----------------------------------------------------------------------
	// Send preview — smaller transfer for 60s audio preview (Plan 14-04)
	// -----------------------------------------------------------------------

	const sendPreview = useCallback(async (previewBlob: Blob) => {
		const conn = connRef.current;
		if (!conn) return;

		const totalChunks = Math.ceil(previewBlob.size / CHUNK_SIZE);
		const buffer = await previewBlob.arrayBuffer();

		for (let i = 0; i < totalChunks; i++) {
			const start = i * CHUNK_SIZE;
			const end = Math.min(start + CHUNK_SIZE, buffer.byteLength);
			const chunkData = buffer.slice(start, end);

			// Backpressure check (same as full transfer, D-08)
			const dc = (conn as unknown as { _dc?: RTCDataChannel })._dc;
			if (dc && dc.bufferedAmount > MAX_BUFFERED_AMOUNT) {
				await new Promise<void>((resolve) => {
					const onLow = () => {
						dc.removeEventListener("bufferedamountlow", onLow);
						resolve();
					};
					dc.bufferedAmountLowThreshold = 262_144;
					dc.addEventListener("bufferedamountlow", onLow);
				});
			}

			conn.send({
				type: "preview-chunk",
				index: i,
				total: totalChunks,
				data: chunkData,
			} as TransferMessage);

			// Update send progress
			setState((prev) => ({
				...prev,
				previewSendProgress: Math.round(((i + 1) / totalChunks) * 100),
			}));
		}

		conn.send({ type: "preview-done", previewSize: previewBlob.size } as TransferMessage);
	}, []);

	// -----------------------------------------------------------------------
	// Retry: reconnect but PRESERVE received chunks for resume
	// -----------------------------------------------------------------------

	const retry = useCallback(() => {
		if (retryTimeoutRef.current) { clearTimeout(retryTimeoutRef.current); retryTimeoutRef.current = null; }
		if (completionTimeoutRef.current) { clearTimeout(completionTimeoutRef.current); completionTimeoutRef.current = null; }
		if (iceTimeoutRef.current) { clearTimeout(iceTimeoutRef.current); iceTimeoutRef.current = null; }

		if (connRef.current) {
			try { connRef.current.close(); } catch { /* non-fatal */ }
			connRef.current = null;
		}

		// Preserve: chunksRef, hadActiveTransferRef, totalChunksExpectedRef, sendCompleteRef, receiveCompleteRef
		// Reset: send resume point based on last ACK'd index
		resumeFromRef.current = lastAckedIndexRef.current + 1;

		const peer = peerRef.current;

		// Case 1: Peer alive and connected to signaling server
		if (peer && !peer.destroyed && !peer.disconnected) {
			setState((prev) => ({ ...prev, status: "waiting", error: null, readyToSend: false }));

			if (role === "sender") {
				const receiverPeerId = buildPeerId(tradeId, counterpartyId);
				let retryCount = 0;
				const MAX_RETRIES = 10;
				const RETRY_DELAY_MS = 2000;

				const attemptConnect = () => {
					if (!peerRef.current || peerRef.current.destroyed || retryCount >= MAX_RETRIES) {
						setState((prev) => ({
							...prev,
							status: hadActiveTransferRef.current ? "disconnected" : "failed",
							error: "Could not reconnect to peer. Click RETRY to try again.",
						}));
						return;
					}
					const conn = peer.connect(receiverPeerId, { reliable: true });
					connRef.current = conn;
					setupDataConnection(conn);
				};

				const onPeerError = (err: { type?: string; message?: string }) => {
					if (err.type === "peer-unavailable") {
						if (retryCount < MAX_RETRIES) {
							retryCount++;
							retryTimeoutRef.current = setTimeout(attemptConnect, RETRY_DELAY_MS);
						} else {
							peer.off("error", onPeerError as Parameters<typeof peer.on>[1]);
							setState((prev) => ({
								...prev,
								status: hadActiveTransferRef.current ? "disconnected" : "failed",
								error: "Peer not available after maximum retries. Click RETRY to try again.",
							}));
						}
					}
				};
				peer.on("error", onPeerError as Parameters<typeof peer.on>[1]);
				attemptConnect();
			}
			return;
		}

		// Case 2: Peer disconnected from signaling but not destroyed
		if (peer && !peer.destroyed && peer.disconnected) {
			setState((prev) => ({ ...prev, status: "waiting", error: null, readyToSend: false }));
			peer.reconnect();
			if (role === "sender") {
				const onReconnectOpen = () => {
					peer.off("open", onReconnectOpen as Parameters<typeof peer.on>[1]);
					const receiverPeerId = buildPeerId(tradeId, counterpartyId);
					const conn = peer.connect(receiverPeerId, { reliable: true });
					connRef.current = conn;
					setupDataConnection(conn);
				};
				peer.on("open", onReconnectOpen as Parameters<typeof peer.on>[1]);
			}
			return;
		}

		// Case 3: Peer destroyed — create a new one (handles "unavailable-id" with retries)
		retryCountRef.current = 0;
		peerRef.current = null;
		initPeer();
	}, [initPeer, role, tradeId, counterpartyId, setupDataConnection]);

	// -----------------------------------------------------------------------
	// Cleanup on unmount
	// -----------------------------------------------------------------------

	const cleanupFn = useCallback(() => {
		if (retryTimeoutRef.current) { clearTimeout(retryTimeoutRef.current); retryTimeoutRef.current = null; }
		if (completionTimeoutRef.current) { clearTimeout(completionTimeoutRef.current); completionTimeoutRef.current = null; }
		if (iceTimeoutRef.current) { clearTimeout(iceTimeoutRef.current); iceTimeoutRef.current = null; }
		if (connRef.current) { connRef.current.close(); connRef.current = null; }
		if (peerRef.current) { peerRef.current.destroy(); peerRef.current = null; }
		chunksRef.current = [];
		previewChunksRef.current = null;
		hadActiveTransferRef.current = false;
		totalChunksExpectedRef.current = 0;
		lastAckedIndexRef.current = -1;
		resumeFromRef.current = 0;
		sendCompleteRef.current = false;
		receiveCompleteRef.current = false;
		retryCountRef.current = 0;
	}, []);

	useEffect(() => {
		initPeer();
		return cleanupFn;
	}, [initPeer, cleanupFn]);

	return { state, sendFile, sendPreview, retry, cleanup: cleanupFn };
}
