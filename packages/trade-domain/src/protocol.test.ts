import { describe, expect, it } from "vitest";
import { TRADE_PROTOCOL_VERSION } from "./constants";
import {
	ackMessageSchema,
	chunkMessageSchema,
	doneMessageSchema,
	previewChunkMessageSchema,
	previewDoneMessageSchema,
	receiverCompleteMessageSchema,
	resumeRequestMessageSchema,
	resumeResponseMessageSchema,
	tradeWireMessageSchema,
} from "./protocol";

const PROTO = TRADE_PROTOCOL_VERSION;

describe("Protocol wire message schemas", () => {
	describe("chunkMessageSchema", () => {
		it("accepts a valid chunk", () => {
			const result = chunkMessageSchema.safeParse({
				tradeProtocolVersion: PROTO,
				type: "chunk",
				index: 0,
				total: 10,
				data: new ArrayBuffer(64),
			});
			expect(result.success).toBe(true);
		});

		it("rejects negative index", () => {
			const result = chunkMessageSchema.safeParse({
				tradeProtocolVersion: PROTO,
				type: "chunk",
				index: -1,
				total: 10,
				data: new ArrayBuffer(64),
			});
			expect(result.success).toBe(false);
		});

		it("rejects zero total", () => {
			const result = chunkMessageSchema.safeParse({
				tradeProtocolVersion: PROTO,
				type: "chunk",
				index: 0,
				total: 0,
				data: new ArrayBuffer(64),
			});
			expect(result.success).toBe(false);
		});

		it("rejects non-ArrayBuffer data", () => {
			const result = chunkMessageSchema.safeParse({
				tradeProtocolVersion: PROTO,
				type: "chunk",
				index: 0,
				total: 10,
				data: "not a buffer",
			});
			expect(result.success).toBe(false);
		});
	});

	describe("doneMessageSchema", () => {
		it("accepts valid done message", () => {
			const result = doneMessageSchema.safeParse({
				tradeProtocolVersion: PROTO,
				type: "done",
				fileName: "track.flac",
				fileSizeBytes: 52428800,
			});
			expect(result.success).toBe(true);
		});

		it("rejects empty filename", () => {
			const result = doneMessageSchema.safeParse({
				tradeProtocolVersion: PROTO,
				type: "done",
				fileName: "",
				fileSizeBytes: 1024,
			});
			expect(result.success).toBe(false);
		});
	});

	describe("ackMessageSchema", () => {
		it("accepts lastReceivedIndex of -1 (no chunks received yet)", () => {
			const result = ackMessageSchema.safeParse({
				tradeProtocolVersion: PROTO,
				type: "ack",
				lastReceivedIndex: -1,
			});
			expect(result.success).toBe(true);
		});

		it("rejects lastReceivedIndex below -1", () => {
			const result = ackMessageSchema.safeParse({
				tradeProtocolVersion: PROTO,
				type: "ack",
				lastReceivedIndex: -2,
			});
			expect(result.success).toBe(false);
		});
	});

	describe("resumeRequestMessageSchema", () => {
		it("accepts valid resume request", () => {
			const result = resumeRequestMessageSchema.safeParse({
				tradeProtocolVersion: PROTO,
				type: "resume-request",
				lastReceivedIndex: 5,
				totalExpectedChunks: 100,
			});
			expect(result.success).toBe(true);
		});
	});

	describe("resumeResponseMessageSchema", () => {
		it("accepts valid resume response", () => {
			const result = resumeResponseMessageSchema.safeParse({
				tradeProtocolVersion: PROTO,
				type: "resume-response",
				resumeFromIndex: 6,
				totalChunks: 100,
				fileName: "vinyl-rip.flac",
				fileSizeBytes: 52428800,
			});
			expect(result.success).toBe(true);
		});
	});

	describe("receiverCompleteMessageSchema", () => {
		it("accepts valid receiver-complete", () => {
			const result = receiverCompleteMessageSchema.safeParse({
				tradeProtocolVersion: PROTO,
				type: "receiver-complete",
			});
			expect(result.success).toBe(true);
		});
	});

	describe("preview messages", () => {
		it("accepts valid preview-chunk", () => {
			const result = previewChunkMessageSchema.safeParse({
				tradeProtocolVersion: PROTO,
				type: "preview-chunk",
				index: 0,
				total: 5,
				data: new ArrayBuffer(32),
			});
			expect(result.success).toBe(true);
		});

		it("accepts valid preview-done", () => {
			const result = previewDoneMessageSchema.safeParse({
				tradeProtocolVersion: PROTO,
				type: "preview-done",
				previewSizeBytes: 1048576,
			});
			expect(result.success).toBe(true);
		});
	});

	describe("discriminated union", () => {
		it("parses chunk via union", () => {
			const result = tradeWireMessageSchema.safeParse({
				tradeProtocolVersion: PROTO,
				type: "chunk",
				index: 0,
				total: 1,
				data: new ArrayBuffer(8),
			});
			expect(result.success).toBe(true);
			if (result.success) {
				expect(result.data.type).toBe("chunk");
			}
		});

		it("rejects unknown message type", () => {
			const result = tradeWireMessageSchema.safeParse({
				tradeProtocolVersion: PROTO,
				type: "unknown",
			});
			expect(result.success).toBe(false);
		});

		it("rejects wrong protocol version", () => {
			const result = tradeWireMessageSchema.safeParse({
				tradeProtocolVersion: 999,
				type: "ack",
				lastReceivedIndex: 0,
			});
			expect(result.success).toBe(false);
		});
	});
});
