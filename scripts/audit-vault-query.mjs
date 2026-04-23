// Phase 33 DEP-AUD-05 — run vault + plaintext count against dev Supabase.
// Reads DATABASE_URL from process.env. One-off audit script; do not commit.
import postgres from "postgres";
import { readFileSync } from "node:fs";

const env = readFileSync("apps/web/.env.local", "utf8");
const dbUrl = env.match(/^DATABASE_URL=(.+)$/m)?.[1]?.trim();
if (!dbUrl) {
	console.error("DATABASE_URL not found in apps/web/.env.local");
	process.exit(1);
}

// Log only the project ref (paranoia — confirm dev, not throwaway)
const refMatch = dbUrl.match(/postgres\.([a-z0-9]+)/);
console.log(`project_ref: ${refMatch?.[1] ?? "UNKNOWN"}`);

const sql = postgres(dbUrl, { prepare: false, max: 1 });

try {
	const plaintext =
		await sql`SELECT COUNT(*)::int AS plaintext_count FROM public.discogs_tokens`;
	console.log(`plaintext_count: ${plaintext[0].plaintext_count}`);

	const vault = await sql`
    SELECT COUNT(*)::int AS vault_count FROM vault.decrypted_secrets
    WHERE name LIKE 'discogs_token:%'
  `;
	console.log(`vault_count: ${vault[0].vault_count}`);

	const plaintextSample = await sql`
    SELECT user_id, LEFT(access_token, 8) AS token_prefix, created_at
    FROM public.discogs_tokens
    LIMIT 3
  `;
	console.log("plaintext_sample:", JSON.stringify(plaintextSample, null, 2));

	const vaultSample = await sql`
    SELECT name, created_at FROM vault.secrets
    WHERE name LIKE 'discogs_token:%'
    LIMIT 3
  `;
	console.log("vault_sample:", JSON.stringify(vaultSample, null, 2));
} catch (err) {
	console.error("ERROR:", err.message);
	process.exit(1);
} finally {
	await sql.end();
}
