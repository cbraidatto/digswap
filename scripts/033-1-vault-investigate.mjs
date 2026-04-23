// Phase 33.1 / DEP-AUD-05 — Vault investigation: probe 3 hypotheses on dev.
// Reads DATABASE_URL from apps/web/.env.local. One-off audit script.
import postgres from "postgres";
import { readFileSync, writeFileSync } from "node:fs";
import { argv } from "node:process";

const env = readFileSync("apps/web/.env.local", "utf8");
const dbUrl = env.match(/^DATABASE_URL=(.+)$/m)?.[1]?.trim();
if (!dbUrl) {
	console.error("DATABASE_URL not found in apps/web/.env.local");
	process.exit(1);
}

const refMatch = dbUrl.match(/postgres\.([a-z0-9]+)/);
const projectRef = refMatch?.[1] ?? "UNKNOWN";

const evidenceDir = ".planning/phases/033.1-audit-gate-closure/evidence";

const sql = postgres(dbUrl, { prepare: false, max: 1 });

function ts() {
	return new Date().toISOString();
}

async function probeA() {
	const lines = [];
	lines.push(`Phase 33.1 / DEP-AUD-05 — Hypothesis A probe (extension installed?)`);
	lines.push(`========================================================================`);
	lines.push(``);
	lines.push(`Project ref: ${projectRef}  (must be 'mrkgoucqcbqjhrdjcnpw' = dev)`);
	lines.push(`Executed:    ${ts()}`);
	lines.push(``);
	lines.push(`Query: SELECT extname, extversion FROM pg_extension WHERE extname = 'supabase_vault';`);
	lines.push(``);

	try {
		const rows = await sql`SELECT extname, extversion FROM pg_extension WHERE extname = 'supabase_vault'`;
		lines.push(`Result rows: ${rows.length}`);
		lines.push(JSON.stringify(rows, null, 2));
		lines.push(``);
		lines.push(`Hypothesis A confirmed: ${rows.length === 0 ? "YES — extension NOT installed" : "NO — extension IS installed"}`);
	} catch (err) {
		lines.push(`ERROR: ${err.message}`);
	}

	writeFileSync(`${evidenceDir}/01a-vault-extension-dev.txt`, lines.join("\n") + "\n");
	console.log(`[01a] written`);
}

async function probeB() {
	const lines = [];
	lines.push(`Phase 33.1 / DEP-AUD-05 — Hypothesis B probe (grants present?)`);
	lines.push(`================================================================`);
	lines.push(``);
	lines.push(`Project ref: ${projectRef}`);
	lines.push(`Executed:    ${ts()}`);
	lines.push(``);

	// Schema USAGE check (only safe if vault schema exists)
	lines.push(`Query 1: schema USAGE on vault for service_role`);
	lines.push(`SELECT has_schema_privilege('service_role', 'vault', 'USAGE');`);
	try {
		const rows = await sql`SELECT has_schema_privilege('service_role', 'vault', 'USAGE') AS usage_ok`;
		lines.push(`Result: ${JSON.stringify(rows[0])}`);
	} catch (err) {
		lines.push(`ERROR (likely vault schema does not exist): ${err.message}`);
	}
	lines.push(``);

	// Function EXECUTE checks
	lines.push(`Query 2: EXECUTE privilege on vault.create_secret`);
	lines.push(`SELECT has_function_privilege('service_role', 'vault.create_secret(text, text, text)', 'EXECUTE');`);
	try {
		const rows = await sql`SELECT has_function_privilege('service_role', 'vault.create_secret(text, text, text)', 'EXECUTE') AS exec_create_ok`;
		lines.push(`Result: ${JSON.stringify(rows[0])}`);
	} catch (err) {
		lines.push(`ERROR: ${err.message}`);
	}
	lines.push(``);

	lines.push(`Query 3: EXECUTE privilege on vault.update_secret`);
	lines.push(`SELECT has_function_privilege('service_role', 'vault.update_secret(uuid, text, text, text)', 'EXECUTE');`);
	try {
		const rows = await sql`SELECT has_function_privilege('service_role', 'vault.update_secret(uuid, text, text, text)', 'EXECUTE') AS exec_update_ok`;
		lines.push(`Result: ${JSON.stringify(rows[0])}`);
	} catch (err) {
		lines.push(`ERROR: ${err.message}`);
	}
	lines.push(``);

	// Schema list
	lines.push(`Query 4: does vault schema exist at all?`);
	try {
		const rows = await sql`SELECT nspname FROM pg_namespace WHERE nspname = 'vault'`;
		lines.push(`Result rows: ${rows.length}  ${JSON.stringify(rows)}`);
	} catch (err) {
		lines.push(`ERROR: ${err.message}`);
	}

	writeFileSync(`${evidenceDir}/01b-vault-grants-dev.txt`, lines.join("\n") + "\n");
	console.log(`[01b] written`);
}

async function probeC() {
	const lines = [];
	lines.push(`Phase 33.1 / DEP-AUD-05 — Hypothesis C probe (RPC wrapper exists?)`);
	lines.push(`====================================================================`);
	lines.push(``);
	lines.push(`Project ref: ${projectRef}`);
	lines.push(`Executed:    ${ts()}`);
	lines.push(``);
	lines.push(`Background: app calls admin.rpc('vault_create_secret', ...). PostgREST`);
	lines.push(`maps rpc names to public schema. Supabase ships vault.create_secret in`);
	lines.push(`the vault schema, NOT public. We need to verify whether public.vault_create_secret`);
	lines.push(`exists as a wrapper.`);
	lines.push(``);
	lines.push(`Query 1: search for any vault_create_secret / create_secret functions across schemas`);
	lines.push(`SELECT n.nspname, p.proname, pg_get_function_identity_arguments(p.oid) AS args`);
	lines.push(`FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace`);
	lines.push(`WHERE p.proname IN ('vault_create_secret', 'create_secret', 'vault_delete_secret', 'vault_update_secret')`);
	lines.push(`ORDER BY n.nspname, p.proname;`);
	lines.push(``);

	try {
		const rows = await sql`
			SELECT n.nspname, p.proname, pg_get_function_identity_arguments(p.oid) AS args
			FROM pg_proc p
			JOIN pg_namespace n ON n.oid = p.pronamespace
			WHERE p.proname IN ('vault_create_secret', 'create_secret', 'vault_delete_secret', 'vault_update_secret')
			ORDER BY n.nspname, p.proname
		`;
		lines.push(`Result rows: ${rows.length}`);
		lines.push(JSON.stringify(rows, null, 2));
		lines.push(``);

		const hasPublicWrapper = rows.some((r) => r.nspname === "public" && r.proname === "vault_create_secret");
		const hasVaultNative = rows.some((r) => r.nspname === "vault" && r.proname === "create_secret");

		lines.push(`hasPublicWrapper (public.vault_create_secret):  ${hasPublicWrapper}`);
		lines.push(`hasVaultNative   (vault.create_secret):         ${hasVaultNative}`);
		lines.push(``);

		if (!hasPublicWrapper) {
			lines.push(`Hypothesis C CONFIRMED: app's admin.rpc('vault_create_secret', ...) call`);
			lines.push(`fails because no public.vault_create_secret wrapper exists. PostgREST returns`);
			lines.push(`a 404-style error object that the silent try/catch in oauth.ts swallows.`);
		} else {
			lines.push(`Hypothesis C disproven: public.vault_create_secret wrapper exists.`);
		}
	} catch (err) {
		lines.push(`ERROR: ${err.message}`);
	}

	writeFileSync(`${evidenceDir}/01c-vault-rpc-smoke-dev.txt`, lines.join("\n") + "\n");
	console.log(`[01c] written (pre-migration probe)`);
}

const phase = argv[2] ?? "investigate";

try {
	if (phase === "investigate") {
		await probeA();
		await probeB();
		await probeC();
	} else {
		console.error(`Unknown phase: ${phase}`);
		process.exit(1);
	}
} finally {
	await sql.end();
}
