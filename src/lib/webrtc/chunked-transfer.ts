export const CHUNK_SIZE = 64 * 1024; // 64KB

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

export type TransferMessage = ChunkMessage | DoneMessage;

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
			const start = index * CHUNK_SIZE;
			const end = Math.min(start + CHUNK_SIZE, file.size);
			return file.slice(start, end).arrayBuffer();
		},
	};
}

/**
 * Reassembles an array of ArrayBuffer chunks into a single Blob.
 */
export function reassembleChunks(
	chunks: ArrayBuffer[],
	_fileName: string,
): Blob {
	return new Blob(chunks, { type: "application/octet-stream" });
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
		progress:
			totalBytes > 0
				? Math.round((bytesTransferred / totalBytes) * 100)
				: 0,
		speed,
		eta,
	};
}
