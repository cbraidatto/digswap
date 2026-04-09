import { describe, expect, it } from "vitest";
import { TRADE_PROTOCOL_VERSION } from "./constants";
import {
	desktopHandoffSchema,
	iceCandidateTypeSchema,
	tradeLeaseSchema,
	tradeRuntimePolicy,
	tradeTransferReceiptSchema,
} from "./runtime";

describe("Runtime schemas", () => {
	describe("iceCandidateTypeSchema", () => {
		it.each(["host", "srflx", "relay"])("accepts '%s'", (type) => {
			expect(iceCandidateTypeSchema.safeParse(type).success).toBe(true);
		});

		it("rejects invalid type", () => {
			expect(iceCandidateTypeSchema.safeParse("prflx").success).toBe(false);
		});
	});

	describe("tradeLeaseSchema", () => {
		const validLease = {
			tradeId: "550e8400-e29b-41d4-a716-446655440000",
			userId: "660e8400-e29b-41d4-a716-446655440001",
			deviceId: "desktop-abc123",
			clientKind: "desktop" as const,
			acquiredAt: "2026-04-06T10:00:00.000Z",
			heartbeatAt: "2026-04-06T10:00:15.000Z",
			releasedAt: null,
			tradeProtocolVersion: TRADE_PROTOCOL_VERSION,
		};

		it("accepts a valid active lease", () => {
			expect(tradeLeaseSchema.safeParse(validLease).success).toBe(true);
		});

		it("accepts a released lease", () => {
			const released = { ...validLease, releasedAt: "2026-04-06T10:05:00.000Z" };
			expect(tradeLeaseSchema.safeParse(released).success).toBe(true);
		});

		it("rejects invalid UUID for tradeId", () => {
			const invalid = { ...validLease, tradeId: "not-a-uuid" };
			expect(tradeLeaseSchema.safeParse(invalid).success).toBe(false);
		});

		it("rejects empty deviceId", () => {
			const invalid = { ...validLease, deviceId: "" };
			expect(tradeLeaseSchema.safeParse(invalid).success).toBe(false);
		});

		it("rejects non-desktop clientKind", () => {
			const invalid = { ...validLease, clientKind: "web" };
			expect(tradeLeaseSchema.safeParse(invalid).success).toBe(false);
		});
	});

	describe("tradeTransferReceiptSchema", () => {
		const validReceipt = {
			tradeId: "550e8400-e29b-41d4-a716-446655440000",
			deviceId: "desktop-abc123",
			fileName: "vinyl-rip.flac",
			fileSizeBytes: 52428800,
			fileHashSha256: "a".repeat(64),
			completedAt: "2026-04-06T10:10:00.000Z",
			iceCandidateType: "host" as const,
			tradeProtocolVersion: TRADE_PROTOCOL_VERSION,
		};

		it("accepts a valid receipt", () => {
			expect(tradeTransferReceiptSchema.safeParse(validReceipt).success).toBe(true);
		});

		it("rejects invalid SHA-256 hash (too short)", () => {
			const invalid = { ...validReceipt, fileHashSha256: "abc" };
			expect(tradeTransferReceiptSchema.safeParse(invalid).success).toBe(false);
		});

		it("rejects invalid SHA-256 hash (non-hex)", () => {
			const invalid = { ...validReceipt, fileHashSha256: "g".repeat(64) };
			expect(tradeTransferReceiptSchema.safeParse(invalid).success).toBe(false);
		});

		it("rejects empty fileName", () => {
			const invalid = { ...validReceipt, fileName: "" };
			expect(tradeTransferReceiptSchema.safeParse(invalid).success).toBe(false);
		});
	});

	describe("desktopHandoffSchema", () => {
		const validHandoff = {
			tradeId: "550e8400-e29b-41d4-a716-446655440000",
			token: "abc123handofftoken",
			minDesktopVersion: "1.0.0",
			expiresAt: "2026-04-06T10:00:30.000Z",
			tradeProtocolVersion: TRADE_PROTOCOL_VERSION,
		};

		it("accepts a valid handoff", () => {
			expect(desktopHandoffSchema.safeParse(validHandoff).success).toBe(true);
		});

		it("rejects empty token", () => {
			const invalid = { ...validHandoff, token: "" };
			expect(desktopHandoffSchema.safeParse(invalid).success).toBe(false);
		});
	});

	describe("tradeRuntimePolicy", () => {
		it("has sensible heartbeat < stale threshold", () => {
			expect(tradeRuntimePolicy.leaseHeartbeatIntervalMs).toBeLessThan(
				tradeRuntimePolicy.leaseStaleAfterMs,
			);
		});

		it("has positive handoff TTL", () => {
			expect(tradeRuntimePolicy.handoffTokenTtlMs).toBeGreaterThan(0);
		});

		it("has correct protocol version", () => {
			expect(tradeRuntimePolicy.tradeProtocolVersion).toBe(TRADE_PROTOCOL_VERSION);
		});
	});
});
