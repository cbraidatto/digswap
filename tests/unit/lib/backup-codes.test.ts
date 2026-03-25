import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock the database module -- backup-codes.ts imports db and schema
vi.mock("@/lib/db", () => ({
	db: {
		select: vi.fn().mockReturnThis(),
		from: vi.fn().mockReturnThis(),
		where: vi.fn().mockReturnThis(),
		insert: vi.fn().mockReturnThis(),
		values: vi.fn().mockResolvedValue([]),
		update: vi.fn().mockReturnThis(),
		set: vi.fn().mockReturnThis(),
		limit: vi.fn().mockResolvedValue([]),
	},
}));

vi.mock("@/lib/db/schema/sessions", () => ({
	backupCodes: {
		id: "id",
		userId: "user_id",
		codeHash: "code_hash",
		used: "used",
		usedAt: "used_at",
		createdAt: "created_at",
	},
}));

describe("Backup Codes", () => {
	describe("generateBackupCodes", () => {
		it("returns 10 codes by default", async () => {
			const { generateBackupCodes } = await import("@/lib/backup-codes");
			const codes = generateBackupCodes();
			expect(codes).toHaveLength(10);
		});

		it("returns the requested number of codes", async () => {
			const { generateBackupCodes } = await import("@/lib/backup-codes");
			const codes = generateBackupCodes(5);
			expect(codes).toHaveLength(5);
		});

		it("generates unique codes (no duplicates)", async () => {
			const { generateBackupCodes } = await import("@/lib/backup-codes");
			const codes = generateBackupCodes(10);
			const uniqueCodes = new Set(codes);
			expect(uniqueCodes.size).toBe(codes.length);
		});

		it("generates codes that are 8 characters long", async () => {
			const { generateBackupCodes } = await import("@/lib/backup-codes");
			const codes = generateBackupCodes();
			for (const code of codes) {
				expect(code).toHaveLength(8);
			}
		});

		it("generates codes using only uppercase alphanumeric characters (no O/0/1/I)", async () => {
			const { generateBackupCodes } = await import("@/lib/backup-codes");
			const codes = generateBackupCodes(20);
			const validCharset = /^[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]+$/;
			for (const code of codes) {
				expect(code).toMatch(validCharset);
			}
		});

		it("does not include ambiguous characters O, 0, 1, I", async () => {
			const { generateBackupCodes } = await import("@/lib/backup-codes");
			// Generate many codes to increase chance of catching invalid chars
			const codes = generateBackupCodes(100);
			for (const code of codes) {
				expect(code).not.toMatch(/[O01I]/);
			}
		});
	});

	describe("hashBackupCode", () => {
		it("produces a hash that differs from the input", async () => {
			const { hashBackupCode } = await import("@/lib/backup-codes");
			const code = "ABCD1234";
			const hash = await hashBackupCode(code);
			expect(hash).not.toBe(code);
			// bcrypt hashes start with $2a$ or $2b$
			expect(hash).toMatch(/^\$2[ab]\$/);
		});

		it("produces different hashes for the same input (salted)", async () => {
			const { hashBackupCode } = await import("@/lib/backup-codes");
			const code = "TESTCODE";
			const hash1 = await hashBackupCode(code);
			const hash2 = await hashBackupCode(code);
			expect(hash1).not.toBe(hash2);
		});
	});

	describe("verifyBackupCode", () => {
		it("returns true for a correct code", async () => {
			const { hashBackupCode, verifyBackupCode } = await import(
				"@/lib/backup-codes"
			);
			const code = "ABCD5678";
			const hash = await hashBackupCode(code);
			const result = await verifyBackupCode(code, hash);
			expect(result).toBe(true);
		});

		it("returns false for an incorrect code", async () => {
			const { hashBackupCode, verifyBackupCode } = await import(
				"@/lib/backup-codes"
			);
			const hash = await hashBackupCode("CORRECT1");
			const result = await verifyBackupCode("WRONGCODE", hash);
			expect(result).toBe(false);
		});

		it("is case-insensitive (codes work regardless of case)", async () => {
			const { hashBackupCode, verifyBackupCode } = await import(
				"@/lib/backup-codes"
			);
			const code = "ABCD5678";
			const hash = await hashBackupCode(code);

			// Verify lowercase works
			const resultLower = await verifyBackupCode("abcd5678", hash);
			expect(resultLower).toBe(true);

			// Verify mixed case works
			const resultMixed = await verifyBackupCode("AbCd5678", hash);
			expect(resultMixed).toBe(true);
		});
	});
});
