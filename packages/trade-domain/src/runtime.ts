import { z } from "zod";
import {
	RECEIVED_FILE_STORE_ROOT_SEGMENTS,
	TRADE_HANDOFF_TOKEN_TTL_MS,
	TRADE_LEASE_HEARTBEAT_INTERVAL_MS,
	TRADE_LEASE_STALE_AFTER_MS,
	TRADE_PROTOCOL_VERSION,
} from "./constants";

export const iceCandidateTypeSchema = z.enum(["host", "srflx", "relay"]);
export type IceCandidateType = z.infer<typeof iceCandidateTypeSchema>;

export const tradeLeaseSchema = z.object({
	tradeId: z.string().uuid(),
	userId: z.string().uuid(),
	deviceId: z.string().min(1),
	clientKind: z.literal("desktop"),
	acquiredAt: z.string().datetime(),
	heartbeatAt: z.string().datetime(),
	releasedAt: z.string().datetime().nullable(),
	tradeProtocolVersion: z.literal(TRADE_PROTOCOL_VERSION),
});

export const tradeTransferReceiptSchema = z.object({
	tradeId: z.string().uuid(),
	deviceId: z.string().min(1),
	fileName: z.string().min(1),
	fileSizeBytes: z.number().int().nonnegative(),
	fileHashSha256: z.string().regex(/^[a-f0-9]{64}$/i),
	completedAt: z.string().datetime(),
	iceCandidateType: iceCandidateTypeSchema,
	tradeProtocolVersion: z.literal(TRADE_PROTOCOL_VERSION),
});

export const desktopHandoffSchema = z.object({
	tradeId: z.string().uuid(),
	token: z.string().min(1),
	minDesktopVersion: z.string().min(1),
	expiresAt: z.string().datetime(),
	tradeProtocolVersion: z.literal(TRADE_PROTOCOL_VERSION),
});

export const receivedFileStoreDescriptorSchema = z.object({
	rootSegments: z.tuple([
		z.literal(RECEIVED_FILE_STORE_ROOT_SEGMENTS[0]),
		z.literal(RECEIVED_FILE_STORE_ROOT_SEGMENTS[1]),
		z.literal(RECEIVED_FILE_STORE_ROOT_SEGMENTS[2]),
	]),
	counterpartyUsername: z.string().min(1),
	tradeId: z.string().uuid(),
	originalFilename: z.string().min(1),
});

export type TradeLease = z.infer<typeof tradeLeaseSchema>;
export type TradeTransferReceipt = z.infer<typeof tradeTransferReceiptSchema>;
export type DesktopHandoff = z.infer<typeof desktopHandoffSchema>;
export type ReceivedFileStoreDescriptor = z.infer<typeof receivedFileStoreDescriptorSchema>;

export const tradeRuntimePolicy = {
	handoffTokenTtlMs: TRADE_HANDOFF_TOKEN_TTL_MS,
	leaseHeartbeatIntervalMs: TRADE_LEASE_HEARTBEAT_INTERVAL_MS,
	leaseStaleAfterMs: TRADE_LEASE_STALE_AFTER_MS,
	tradeProtocolVersion: TRADE_PROTOCOL_VERSION,
} as const;
