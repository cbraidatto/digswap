import { describe, it, expect } from "vitest";
import {
	sliceFileIntoChunks,
	reassembleChunks,
	calculateTransferStats,
	CHUNK_SIZE,
} from "@/lib/webrtc/chunked-transfer";

describe("chunked-transfer", () => {
	it("sliceFileIntoChunks returns correct chunk count for file size", () => {
		// Create a mock File-like object
		const fileSize = CHUNK_SIZE * 3 + 1000; // 3 full chunks + partial
		const blob = new Blob([new ArrayBuffer(fileSize)]);
		const file = new File([blob], "test.flac", { type: "audio/flac" });

		const { totalChunks } = sliceFileIntoChunks(file);

		expect(totalChunks).toBe(4); // 3 full + 1 partial
	});

	it("reassembleChunks creates a blob from ArrayBuffer array", () => {
		const chunk1 = new ArrayBuffer(100);
		const chunk2 = new ArrayBuffer(200);

		const blob = reassembleChunks([chunk1, chunk2], "test.flac");

		expect(blob).toBeInstanceOf(Blob);
		expect(blob.size).toBe(300);
		expect(blob.type).toBe("application/octet-stream");
	});

	it("calculateTransferStats returns correct progress percentage", () => {
		const startTime = Date.now() - 1000; // 1 second ago
		const stats = calculateTransferStats(500_000, 1_000_000, startTime);

		expect(stats.progress).toBe(50);
	});

	it("calculateTransferStats returns correct ETA", () => {
		const startTime = Date.now() - 2000; // 2 seconds ago
		const bytesTransferred = 500_000;
		const totalBytes = 1_000_000;

		const stats = calculateTransferStats(
			bytesTransferred,
			totalBytes,
			startTime,
		);

		// Speed ~250KB/s, remaining 500KB, ETA ~2 seconds
		expect(stats.eta).toBeGreaterThan(1);
		expect(stats.eta).toBeLessThan(3);
		expect(stats.speed).toBeGreaterThan(200_000);
	});
});
