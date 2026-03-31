import { z } from "zod";
import { TRADE_PROTOCOL_VERSION } from "./constants";

const arrayBufferSchema = z.custom<ArrayBuffer>(
	(value) => value instanceof ArrayBuffer,
	"Expected ArrayBuffer",
);

const wireMessageBaseSchema = z.object({
	tradeProtocolVersion: z.literal(TRADE_PROTOCOL_VERSION),
});

export const chunkMessageSchema = wireMessageBaseSchema.extend({
	type: z.literal("chunk"),
	index: z.number().int().min(0),
	total: z.number().int().positive(),
	data: arrayBufferSchema,
});

export const doneMessageSchema = wireMessageBaseSchema.extend({
	type: z.literal("done"),
	fileName: z.string().min(1),
	fileSizeBytes: z.number().int().nonnegative(),
});

export const ackMessageSchema = wireMessageBaseSchema.extend({
	type: z.literal("ack"),
	lastReceivedIndex: z.number().int().min(-1),
});

export const resumeRequestMessageSchema = wireMessageBaseSchema.extend({
	type: z.literal("resume-request"),
	lastReceivedIndex: z.number().int().min(-1),
	totalExpectedChunks: z.number().int().min(0),
});

export const resumeResponseMessageSchema = wireMessageBaseSchema.extend({
	type: z.literal("resume-response"),
	resumeFromIndex: z.number().int().min(0),
	totalChunks: z.number().int().positive(),
	fileName: z.string().min(1),
	fileSizeBytes: z.number().int().nonnegative(),
});

export const receiverCompleteMessageSchema = wireMessageBaseSchema.extend({
	type: z.literal("receiver-complete"),
});

export const previewChunkMessageSchema = wireMessageBaseSchema.extend({
	type: z.literal("preview-chunk"),
	index: z.number().int().min(0),
	total: z.number().int().positive(),
	data: arrayBufferSchema,
});

export const previewDoneMessageSchema = wireMessageBaseSchema.extend({
	type: z.literal("preview-done"),
	previewSizeBytes: z.number().int().nonnegative(),
});

export const tradeWireMessageSchema = z.discriminatedUnion("type", [
	chunkMessageSchema,
	doneMessageSchema,
	ackMessageSchema,
	resumeRequestMessageSchema,
	resumeResponseMessageSchema,
	receiverCompleteMessageSchema,
	previewChunkMessageSchema,
	previewDoneMessageSchema,
]);

export type ChunkMessage = z.infer<typeof chunkMessageSchema>;
export type DoneMessage = z.infer<typeof doneMessageSchema>;
export type AckMessage = z.infer<typeof ackMessageSchema>;
export type ResumeRequestMessage = z.infer<typeof resumeRequestMessageSchema>;
export type ResumeResponseMessage = z.infer<typeof resumeResponseMessageSchema>;
export type ReceiverCompleteMessage = z.infer<typeof receiverCompleteMessageSchema>;
export type PreviewChunkMessage = z.infer<typeof previewChunkMessageSchema>;
export type PreviewDoneMessage = z.infer<typeof previewDoneMessageSchema>;
export type TradeWireMessage = z.infer<typeof tradeWireMessageSchema>;
