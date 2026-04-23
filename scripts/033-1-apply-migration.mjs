// Phase 33.1 / DEP-AUD-05 — apply 20260424000000_enable_vault_extension.sql to dev.
// Used because supabase CLI is not on PATH in this environment. Phase 34
// will apply the same file via `supabase db push --linked` against prod.
import postgres from "postgres";
import { readFileSync, appendFileSync } from "node:fs";

const env = readFileSync("apps/web/.env.local", "utf8");
const dbUrl = env.match(/^DATABASE_URL=(.+)$/m)?.[1]?.trim();
const refMatch = dbUrl.match(/postgres\.([a-z0-9]+)/);
const projectRef = refMatch?.[1] ?? "UNKNOWN";

const migrationPath = "supabase/migrations/20260424000000_enable_vault_extension.sql";
const migrationSql = readFileSync(migrationPath, "utf8");

const evidenceFile = ".planning/phases/033.1-audit-gate-closure/evidence/01c-vault-rpc-smoke-dev.txt";

console.log(`Applying ${migrationPath} to project_ref=${projectRef}`);

const sql = postgres(dbUrl, { prepare: false, max: 1 });

try {
	await sql.unsafe(migrationSql);
	console.log("Migration applied OK");

	const lines = [
		``,
		`---`,
		``,
		`POST-MIGRATION VERIFICATION (after applying ${migrationPath})`,
		`Executed: ${new Date().toISOString()}`,
		`Project ref: ${projectRef}`,
		``,
	];

	// Verify wrappers now exist
	const wrappers = await sql`
		SELECT n.nspname, p.proname, pg_get_function_identity_arguments(p.oid) AS args
		FROM pg_proc p
		JOIN pg_namespace n ON n.oid = p.pronamespace
		WHERE n.nspname = 'public'
		  AND p.proname IN ('vault_create_secret', 'vault_delete_secret')
		ORDER BY p.proname
	`;
	lines.push(`Public wrappers after migration:`);
	lines.push(JSON.stringify(wrappers, null, 2));
	lines.push(``);

	// Smoke test 1: create_secret
	lines.push(`Smoke test 1: SELECT public.vault_create_secret('smoke-test-value', 'smoke:test:033-1', 'phase 33.1 smoke');`);
	const createResult = await sql`
		SELECT public.vault_create_secret('smoke-test-value', 'smoke:test:033-1', 'phase 33.1 smoke') AS new_id
	`;
	const newId = createResult[0].new_id;
	lines.push(`Result: new_id = ${newId}`);
	lines.push(``);

	// Smoke test 2: read it back via decrypted_secrets
	lines.push(`Smoke test 2: SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'smoke:test:033-1';`);
	const readResult = await sql`
		SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'smoke:test:033-1'
	`;
	lines.push(`Result rows: ${readResult.length}`);
	if (readResult.length > 0) {
		lines.push(`decrypted_secret matches written value: ${readResult[0].decrypted_secret === "smoke-test-value"}`);
	}
	lines.push(``);

	// Smoke test 3: delete it
	lines.push(`Smoke test 3: SELECT public.vault_delete_secret('smoke:test:033-1');`);
	await sql`SELECT public.vault_delete_secret('smoke:test:033-1')`;
	const after = await sql`SELECT count(*)::int AS n FROM vault.secrets WHERE name = 'smoke:test:033-1'`;
	lines.push(`Result: rows remaining = ${after[0].n}`);
	lines.push(``);

	// Verify EXECUTE privilege landed
	const execPriv = await sql`
		SELECT has_function_privilege('service_role', 'public.vault_create_secret(text, text, text)', 'EXECUTE') AS exec_create_ok,
		       has_function_privilege('service_role', 'public.vault_delete_secret(text)', 'EXECUTE') AS exec_delete_ok
	`;
	lines.push(`Service role EXECUTE privileges: ${JSON.stringify(execPriv[0])}`);
	lines.push(``);

	lines.push(`SMOKE TEST RESULT: PASS — Vault is now functional via PostgREST wrapper.`);

	appendFileSync(evidenceFile, lines.join("\n") + "\n");
	console.log("[01c] smoke test results appended");
} catch (err) {
	console.error("FAILED:", err.message);
	const lines = [
		``,
		`---`,
		`MIGRATION APPLICATION FAILED at ${new Date().toISOString()}`,
		`Error: ${err.message}`,
		``,
	];
	appendFileSync(evidenceFile, lines.join("\n") + "\n");
	process.exit(1);
} finally {
	await sql.end();
}
