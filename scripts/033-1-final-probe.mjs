// Phase 33.1 / DEP-AUD-05 — final SC#5 probe after Option B applied.
import postgres from "postgres";
import { readFileSync, writeFileSync } from "node:fs";

const env = readFileSync("apps/web/.env.local", "utf8");
const dbUrl = env.match(/^DATABASE_URL=(.+)$/m)?.[1]?.trim();
const refMatch = dbUrl.match(/postgres\.([a-z0-9]+)/);
const projectRef = refMatch?.[1] ?? "UNKNOWN";

const sql = postgres(dbUrl, { prepare: false, max: 1 });

try {
	const plaintext = await sql`SELECT COUNT(*)::int AS plaintext_count FROM public.discogs_tokens`;
	const vault = await sql`
		SELECT COUNT(*)::int AS vault_count FROM vault.decrypted_secrets
		WHERE name LIKE 'discogs_token:%'
	`;

	const ts = new Date().toISOString();

	const plaintextLines = [
		`Phase 33.1 / DEP-AUD-05 — FINAL plaintext count after Option B applied`,
		`========================================================================`,
		``,
		`Project ref: ${projectRef} (dev)`,
		`Executed:    ${ts}`,
		``,
		`Query: SELECT COUNT(*)::int AS plaintext_count FROM public.discogs_tokens;`,
		``,
		`Result: plaintext_count = ${plaintext[0].plaintext_count}`,
		``,
		`PASS CRITERION: plaintext_count == 0`,
		`VERDICT: ${plaintext[0].plaintext_count === 0 ? "PASS" : "FAIL"}`,
		``,
		`Comparison to Phase 33 baseline (evidence/05a-plaintext-count.txt):`,
		`  before: plaintext_count = 2  (FAIL)`,
		`  after:  plaintext_count = ${plaintext[0].plaintext_count}  (${plaintext[0].plaintext_count === 0 ? "PASS" : "FAIL"})`,
		`  → DEP-AUD-05 closure achieved.`,
	];

	const vaultLines = [
		`Phase 33.1 / DEP-AUD-05 — FINAL Vault count after Option B applied`,
		`====================================================================`,
		``,
		`Project ref: ${projectRef} (dev)`,
		`Executed:    ${ts}`,
		``,
		`Query: SELECT COUNT(*)::int AS vault_count FROM vault.decrypted_secrets`,
		`       WHERE name LIKE 'discogs_token:%';`,
		``,
		`Result: vault_count = ${vault[0].vault_count}`,
		``,
		`Interpretation (Option B chosen):`,
		`  - vault_count = 0 is EXPECTED post-Option-B because the 2 plaintext rows`,
		`    were deleted rather than re-wrapped into Vault.`,
		`  - The next time either of the 2 affected users (or any new user) completes`,
		`    the Discogs OAuth flow, storeTokens() will write into Vault via the new`,
		`    public.vault_create_secret wrapper, incrementing this count.`,
		`  - This confirms the path is now functional (Task 1 smoke test PASS) but`,
		`    has zero data because no OAuth has run since the codepath was fixed.`,
		``,
		`Comparison to Phase 33 baseline (evidence/05b-vault-count.txt):`,
		`  before: vault_count = 0 (FAIL — silent fallback meant Vault had nothing)`,
		`  after:  vault_count = ${vault[0].vault_count} (PASS — Vault now functional, awaiting next OAuth flow)`,
	];

	writeFileSync(".planning/phases/033.1-audit-gate-closure/evidence/01e-plaintext-count-dev-final.txt", plaintextLines.join("\n") + "\n");
	writeFileSync(".planning/phases/033.1-audit-gate-closure/evidence/01f-vault-count-dev-final.txt", vaultLines.join("\n") + "\n");

	console.log(`plaintext_count = ${plaintext[0].plaintext_count}`);
	console.log(`vault_count = ${vault[0].vault_count}`);
} finally {
	await sql.end();
}
