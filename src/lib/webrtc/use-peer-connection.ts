"use client";

import { useEffect, useRef, useCallback, useState } from "react";
import Peer from "peerjs";
import type { DataConnection } from "peerjs";
import {
	sliceFileIntoChunks,
	reassembleChunks,
	calculateTransferStats,
	type TransferMessage,
	CHUNK_SIZE,
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
		| "failed";
	progress: number; // 0-100
	bytesTransferred: number;
	totalBytes: number;
	speed: number; // bytes/sec
	eta: number; // seconds remaining
	error: string | null;
	receivedFile: Blob | null;
	receivedFileName: string | null;
}

const INITIAL_STATE: PeerState = {
	status: "idle",
	progress: 0,
	bytesTransferred: 0,
	totalBytes: 0,
	speed: 0,
	eta: 0,
	error: null,
	receivedFile: null,
	receivedFileName: null,
};

// Max buffered amount before pausing sends (256 KB)
const MAX_BUFFERED_AMOUNT = 256 * 1024;

// Throttle progress updates to every 100ms
const PROGRESS_THROTTLE_MS = 100;

// ---------------------------------------------------------------------------
// Helper: build deterministic peer ID
// ---------------------------------------------------------------------------

function buildPeerId(tradeId: string, odUserId: string): string {
	return `digswap-${tradeId}-${odUserId.substring(0, 8)}`;
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function usePeerConnection(
	tradeId: string,
	userId: string,
	role: "sender" | "receiver",
	iceServers: RTCIceServer[],
	file?: File,
): {
	state: PeerState;
	sendFile: () => Promise<void>;
	retry: () => void;
	cleanup: () => void;
} {
	const [state, setState] = useState<PeerState>(INITIAL_STATE);
	const peerRef = useRef<Peer | null>(null);
	const connRef = useRef<DataConnection | null>(null);
	const chunksRef = useRef<ArrayBuffer[]>([]);
	const startTimeRef = useRef<number>(0);
	const lastProgressUpdateRef = useRef<number>(0);

	// -----------------------------------------------------------------------
	// Initialize peer
	// -----------------------------------------------------------------------

	const initPeer = useCallback(() => {
		// Cleanup any existing peer
		if (peerRef.current) {
			peerRef.current.destroy();
		}

		setState({ ...INITIAL_STATE, status: "idle" });

		const peerId = buildPeerId(tradeId, userId);
		const peer = new Peer(peerId, {
			config: { iceServers },
			debug: 0,
		});

		peerRef.current = peer;

		peer.on("open", () => {
			setState((prev) => ({ ...prev, status: "waiting" }));
		});

		peer.on("error", (err) => {
			setState((prev) => ({
				...prev,
				status: "failed",
				error: err.message || "Peer connection error",
			}));
		});

		// Handle incoming connections (receiver receives connection from sender)
		peer.on("connection", (conn) => {
			connRef.current = conn;
			setState((prev) => ({ ...prev, status: "connecting" }));
			setupDataConnection(conn);
		});
	}, [tradeId, userId, iceServers]); // eslint-disable-line react-hooks/exhaustive-deps

	// -----------------------------------------------------------------------
	// Setup data connection listeners
	// -----------------------------------------------------------------------

	const setupDataConnection = useCallback(
		(conn: DataConnection) => {
			conn.on("open", () => {
				setState((prev) => ({ ...prev, status: "connecting" }));

				// If sender and file provided, sending will be triggered by sendFile()
				// If receiver, wait for incoming chunks
				if (role === "receiver") {
					chunksRef.current = [];
					startTimeRef.current = Date.now();
				}
			});

			conn.on("data", (rawData: unknown) => {
				const data = rawData as TransferMessage;

				if (data.type === "chunk") {
					// Receiver: collect chunks
					chunksRef.current[data.index] = data.data;
					const bytesTransferred =
						chunksRef.current.reduce(
							(sum, chunk) => sum + (chunk?.byteLength ?? 0),
							0,
						);
					const totalBytes = data.total * CHUNK_SIZE;

					// Throttle progress updates
					const now = Date.now();
					if (now - lastProgressUpdateRef.current >= PROGRESS_THROTTLE_MS) {
						lastProgressUpdateRef.current = now;
						const stats = calculateTransferStats(
							bytesTransferred,
							totalBytes,
							startTimeRef.current,
						);
						setState((prev) => ({
							...prev,
							status: "transferring",
							bytesTransferred,
							totalBytes,
							progress: stats.progress,
							speed: stats.speed,
							eta: stats.eta,
						}));
					}
				} else if (data.type === "done") {
					// Receiver: reassemble file
					const blob = reassembleChunks(chunksRef.current, data.fileName);
					setState((prev) => ({
						...prev,
						status: "complete",
						progress: 100,
						bytesTransferred: data.fileSize,
						totalBytes: data.fileSize,
						receivedFile: blob,
						receivedFileName: data.fileName,
					}));
				}
			});

			conn.on("close", () => {
				setState((prev) => {
					if (prev.status === "complete") return prev;
					return {
						...prev,
						status: "failed",
						error: "Connection closed unexpectedly",
					};
				});
			});

			conn.on("error", (err) => {
				setState((prev) => ({
					...prev,
					status: "failed",
					error: err.message || "Data channel error",
				}));
			});
		},
		[role],
	);

	// -----------------------------------------------------------------------
	// Connect to counterpart (sender initiates connection to receiver)
	// -----------------------------------------------------------------------

	const connectToCounterpart = useCallback(
		(counterpartPeerId: string) => {
			const peer = peerRef.current;
			if (!peer) return;

			const conn = peer.connect(counterpartPeerId, { reliable: true });
			connRef.current = conn;
			setState((prev) => ({ ...prev, status: "connecting" }));
			setupDataConnection(conn);
		},
		[setupDataConnection],
	);

	// -----------------------------------------------------------------------
	// Send file (sender only)
	// -----------------------------------------------------------------------

	const sendFile = useCallback(async () => {
		if (role !== "sender" || !file) return;

		const conn = connRef.current;
		if (!conn) {
			setState((prev) => ({
				...prev,
				status: "failed",
				error: "No connection established",
			}));
			return;
		}

		setState((prev) => ({ ...prev, status: "transferring" }));
		startTimeRef.current = Date.now();

		const { totalChunks, getChunk } = sliceFileIntoChunks(file);

		try {
			for (let i = 0; i < totalChunks; i++) {
				const chunkData = await getChunk(i);

				// Flow control: wait if buffer is full
				// Access the underlying RTCDataChannel's bufferedAmount
				const dc = (conn as unknown as { _dc?: RTCDataChannel })._dc;
				if (dc && dc.bufferedAmount > MAX_BUFFERED_AMOUNT) {
					await new Promise<void>((resolve) => {
						const onLow = () => {
							dc.removeEventListener("bufferedamountlow", onLow);
							resolve();
						};
						dc.bufferedAmountLowThreshold = CHUNK_SIZE;
						dc.addEventListener("bufferedamountlow", onLow);
					});
				}

				const message: TransferMessage = {
					type: "chunk",
					index: i,
					total: totalChunks,
					data: chunkData,
				};

				conn.send(message);

				// Update progress (throttled)
				const now = Date.now();
				if (now - lastProgressUpdateRef.current >= PROGRESS_THROTTLE_MS) {
					lastProgressUpdateRef.current = now;
					const bytesTransferred = (i + 1) * CHUNK_SIZE;
					const stats = calculateTransferStats(
						bytesTransferred,
						file.size,
						startTimeRef.current,
					);
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

			// Send done message
			const doneMessage: TransferMessage = {
				type: "done",
				fileName: file.name,
				fileSize: file.size,
			};
			conn.send(doneMessage);

			setState((prev) => ({
				...prev,
				status: "complete",
				progress: 100,
				bytesTransferred: file.size,
				totalBytes: file.size,
			}));
		} catch (err) {
			setState((prev) => ({
				...prev,
				status: "failed",
				error:
					err instanceof Error ? err.message : "File transfer failed",
			}));
		}
	}, [role, file]);

	// -----------------------------------------------------------------------
	// Retry: destroy and reinitialize
	// -----------------------------------------------------------------------

	const retry = useCallback(() => {
		if (peerRef.current) {
			peerRef.current.destroy();
			peerRef.current = null;
		}
		connRef.current = null;
		chunksRef.current = [];
		initPeer();
	}, [initPeer]);

	// -----------------------------------------------------------------------
	// Cleanup on unmount
	// -----------------------------------------------------------------------

	const cleanupFn = useCallback(() => {
		if (connRef.current) {
			connRef.current.close();
			connRef.current = null;
		}
		if (peerRef.current) {
			peerRef.current.destroy();
			peerRef.current = null;
		}
		chunksRef.current = [];
	}, []);

	useEffect(() => {
		initPeer();
		return cleanupFn;
	}, [initPeer, cleanupFn]);

	return {
		state,
		sendFile,
		retry,
		cleanup: cleanupFn,
	};
}
