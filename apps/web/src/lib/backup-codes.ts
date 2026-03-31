import { randomBytes } from "node:crypto";
import bcrypt from "bcryptjs";
import { eq, and } from "drizzle-orm";
import { db } from "@/lib/db";
import { backupCodes } from "@/lib/db/schema/sessions";

const BACKUP_CODE_LENGTH = 8;
const BCRYPT_WORK_FACTOR = 10;

/**
 * Generate cryptographically secure backup codes.
 * Each code is 8 uppercase alphanumeric characters.
 * Returns plaintext codes (shown to user once, then discarded).
 */
export function generateBackupCodes(count = 10): string[] {
	const codes: string[] = [];
	const charset = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // Omit O/0/1/I for readability

	for (let i = 0; i < count; i++) {
		const bytes = randomBytes(BACKUP_CODE_LENGTH);
		let code = "";
		for (let j = 0; j < BACKUP_CODE_LENGTH; j++) {
			code += charset[bytes[j] % charset.length];
		}
		codes.push(code);
	}

	return codes;
}

/**
 * Hash a backup code using bcrypt (work factor 10).
 * Used before storing codes in the database.
 */
export async function hashBackupCode(code: string): Promise<string> {
	return bcrypt.hash(code.toUpperCase().trim(), BCRYPT_WORK_FACTOR);
}

/**
 * Compare a plaintext backup code against a bcrypt hash.
 * Returns true if the code matches.
 */
export async function verifyBackupCode(
	code: string,
	hash: string,
): Promise<boolean> {
	return bcrypt.compare(code.toUpperCase().trim(), hash);
}

/**
 * Store hashed backup codes in the database for a user.
 * Deletes (invalidates) any existing unused codes first -- re-enrollment replaces old codes.
 * Per STATE.md decision: codes use invalidation (used=true) not deletion for audit trail,
 * but on re-enrollment we mark all old unused codes as used before inserting new ones.
 */
export async function storeBackupCodes(
	userId: string,
	codes: string[],
): Promise<void> {
	// Mark all existing unused codes as consumed (audit trail preserved)
	await db
		.update(backupCodes)
		.set({ used: true, usedAt: new Date() })
		.where(and(eq(backupCodes.userId, userId), eq(backupCodes.used, false)));

	// Hash all new codes
	const hashedCodes = await Promise.all(codes.map((c) => hashBackupCode(c)));

	// Insert new hashed codes
	const rows = hashedCodes.map((codeHash) => ({
		userId,
		codeHash,
		used: false,
	}));

	if (rows.length > 0) {
		await db.insert(backupCodes).values(rows);
	}
}

/**
 * Consume a backup code during login.
 * Finds all unused codes for the user, verifies against each hash.
 * If a match is found, marks the code as used (used=true, used_at=now()).
 * Returns true if a valid code was consumed.
 */
export async function consumeBackupCode(
	userId: string,
	code: string,
): Promise<{ success: boolean; remainingCodes: number }> {
	// Fetch all unused codes for the user
	const unusedCodes = await db
		.select()
		.from(backupCodes)
		.where(and(eq(backupCodes.userId, userId), eq(backupCodes.used, false)));

	// Check each hash (bcrypt compare is intentionally slow for security)
	for (const row of unusedCodes) {
		const isMatch = await verifyBackupCode(code, row.codeHash);
		if (isMatch) {
			// Atomic claim: WHERE id = ? AND used = false (compare-and-swap)
			const result = await db
				.update(backupCodes)
				.set({ used: true, usedAt: new Date() })
				.where(and(eq(backupCodes.id, row.id), eq(backupCodes.used, false)))
				.returning({ id: backupCodes.id });

			if (result.length === 0) {
				// Another request already consumed this code -- try next
				continue;
			}

			return {
				success: true,
				remainingCodes: unusedCodes.length - 1,
			};
		}
	}

	return { success: false, remainingCodes: unusedCodes.length };
}
