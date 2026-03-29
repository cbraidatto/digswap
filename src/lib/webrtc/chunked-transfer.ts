export const CHUNK_SIZE = 64 * 1024; // 64KB

// How many chunks between ACKs from receiver
export const ACK_INTERVAL = 16; // ACK every 16 chunks (~1MB)

export interface ChunkMessage {
	type: "chunk";
	index: number;
	total: number;
	data: ArrayBuffer;
}

export interface DoneMessage {
	type: "done";
	fileName: string;
	fileSize: number;
}

/** Receiver -> Sender: acknowledge received chunks up to this index */
export interface AckMessage {
	type: "ack";
	lastReceivedIndex: number;
}

/** Receiver -> Sender: on reconnect, tell sender where to resume */
export interface ResumeRequestMessage {
	type: "resume-request";
	lastReceivedIndex: number; // -1 if no chunks received
	totalExpected: number; // 0 if unknown (first connection attempt)
}

/** Sender -> Receiver: confirm resume point and total chunks */
export interface ResumeResponseMessage {
	type: "resume-response";
	resumeFromIndex: number;
	totalChunks: number;
	fileName: string;
	fileSize: number;
}

/** Receiver -> Sender: all chunks received, file reassembled */
export interface ReceiverCompleteMessage {
	type: "receiver-complete";
}

/** Preview chunk: smaller transfer for 60s audio preview (Plan 14-04) */
export interface PreviewChunkMessage {
	type: "preview-chunk";
	index: number;
	total: number;
	data: ArrayBuffer;
}

/** Signal that all preview chunks have been sent */
export interface PreviewDoneMessage {
	type: "preview-done";
	previewSize: number;
}

export type TransferMessage =
	| ChunkMessage
	| DoneMessage
	| AckMessage
	| ResumeRequestMessage
	| ResumeResponseMessage
	| ReceiverCompleteMessage
	| PreviewChunkMessage
	| PreviewDoneMessage;

/**
 * Validates that a chunk index is within valid bounds.
 */
export function isValidChunkIndex(index: number, total: number): boolean {
	return (
		Number.isInteger(index) && Number.isInteger(total) && total > 0 && index >= 0 && index < total
	);
}

/**
 * Slices a File into CHUNK_SIZE chunks. Returns a lazy accessor
 * so chunks are read on demand (avoids loading entire file into memory).
 */
export function sliceFileIntoChunks(file: File): {
	totalChunks: number;
	getChunk: (index: number) => Promise<ArrayBuffer>;
} {
	const totalChunks = Math.ceil(file.size / CHUNK_SIZE);
	return {
		totalChunks,
		getChunk: async (index: number) => {
			if (index < 0 || index >= totalChunks) {
				throw new RangeError(`Chunk index ${index} out of bounds [0, ${totalChunks})`);
			}
			const start = index * CHUNK_SIZE;
			const end = Math.min(start + CHUNK_SIZE, file.size);
			return file.slice(start, end).arrayBuffer();
		},
	};
}

/**
 * Reassembles an array of ArrayBuffer chunks into a single Blob.
 */
export function reassembleChunks(chunks: ArrayBuffer[], _fileName: string): Blob {
	return new Blob(chunks, { type: "application/octet-stream" });
}

/**
 * Count how many chunks have been received (non-empty slots in the array).
 */
export function countReceivedChunks(chunks: ArrayBuffer[]): number {
	let count = 0;
	for (let i = 0; i < chunks.length; i++) {
		if (chunks[i]) count++;
	}
	return count;
}

/**
 * Find the highest contiguous chunk index received (from 0).
 * Returns -1 if no chunks received.
 */
export function highestContiguousChunk(chunks: ArrayBuffer[]): number {
	for (let i = 0; i < chunks.length; i++) {
		if (!chunks[i]) return i - 1;
	}
	return chunks.length - 1;
}

/**
 * Calculates real-time transfer statistics: progress %, speed (bytes/s), ETA (seconds).
 */
export function calculateTransferStats(
	bytesTransferred: number,
	totalBytes: number,
	startTime: number,
): {
	progress: number;
	speed: number;
	eta: number;
} {
	const elapsed = (Date.now() - startTime) / 1000;
	const speed = elapsed > 0 ? bytesTransferred / elapsed : 0;
	const remaining = totalBytes - bytesTransferred;
	const eta = speed > 0 ? remaining / speed : 0;
	return {
		progress: totalBytes > 0 ? Math.round((bytesTransferred / totalBytes) * 100) : 0,
		speed,
		eta,
	};
}
