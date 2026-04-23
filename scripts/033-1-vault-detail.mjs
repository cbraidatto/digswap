import postgres from "postgres";
import { readFileSync } from "node:fs";

const env = readFileSync("apps/web/.env.local", "utf8");
const dbUrl = env.match(/^DATABASE_URL=(.+)$/m)?.[1]?.trim();
const sql = postgres(dbUrl, { prepare: false, max: 1 });

try {
	const all = await sql`
		SELECT n.nspname, p.proname, pg_get_function_identity_arguments(p.oid) AS args
		FROM pg_proc p
		JOIN pg_namespace n ON n.oid = p.pronamespace
		WHERE n.nspname = 'vault'
		ORDER BY p.proname
	`;
	console.log("vault.* functions:", JSON.stringify(all, null, 2));

	// Check if anonymous service_role connection has SELECT on vault.decrypted_secrets / vault.secrets
	const tableGrants = await sql`
		SELECT grantee, table_schema, table_name, privilege_type
		FROM information_schema.table_privileges
		WHERE table_schema = 'vault' AND grantee IN ('service_role', 'authenticator', 'authenticated', 'anon')
		ORDER BY grantee, table_name
	`;
	console.log("vault table grants:", JSON.stringify(tableGrants, null, 2));
} finally {
	await sql.end();
}
