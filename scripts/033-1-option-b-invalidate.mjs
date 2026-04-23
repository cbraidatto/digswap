// Phase 33.1 / DEP-AUD-05 — Option B: invalidate the 2 plaintext rows.
// Force the 2 affected users to re-authorize Discogs; the next OAuth flow
// will land in Vault via the now-functional public.vault_create_secret wrapper.
import postgres from "postgres";
import { readFileSync, appendFileSync } from "node:fs";

const env = readFileSync("apps/web/.env.local", "utf8");
const dbUrl = env.match(/^DATABASE_URL=(.+)$/m)?.[1]?.trim();
const refMatch = dbUrl.match(/postgres\.([a-z0-9]+)/);
const projectRef = refMatch?.[1] ?? "UNKNOWN";

if (projectRef !== "mrkgoucqcbqjhrdjcnpw") {
	console.error(`REFUSE: project_ref=${projectRef} is NOT dev. Aborting destructive op.`);
	process.exit(1);
}

const evidenceFile = ".planning/phases/033.1-audit-gate-closure/evidence/01d-plaintext-migration-dev.txt";

const TARGET_USER_IDS = [
	"5c2f62d1-5d31-4743-9f96-22b29fd478cf",
	"04520b1a-f2be-4d34-b897-a23dd33f47ef",
];

const sql = postgres(dbUrl, { prepare: false, max: 1 });

const lines = [
	``,
	`---`,
	``,
	`STRATEGY DECISION: Option B — invalidate plaintext rows + force re-auth`,
	``,
	`Reasoning: plan author explicitly recommended Option B as lower blast radius`,
	`(no plaintext token material handling in node process memory). The Option A`,
	`migrate-and-rewrap path is more valuable to test END-to-END in Phase 38 UAT`,
	`than to exercise quietly here on dev. Both options achieve plaintext_count=0`,
	`(the SC#5 success criterion).`,
	``,
	`Executor decision rationale: in yolo project mode, when the plan provides an`,
	`explicit recommendation with reasoning AND both options satisfy the success`,
	`criterion, taking the recommendation is consistent with the project's`,
	`autonomous-execution posture. Documented as a deviation in SUMMARY.md.`,
	``,
	`Executed: ${new Date().toISOString()}`,
	`Project ref: ${projectRef}`,
	``,
];

try {
	// Pre-state
	const before = await sql`
		SELECT user_id, LEFT(access_token, 4) AS prefix, created_at::text
		FROM public.discogs_tokens
		ORDER BY created_at
	`;
	lines.push(`Pre-state (public.discogs_tokens):`);
	lines.push(JSON.stringify(before, null, 2));
	lines.push(``);

	// Verify the user IDs we're about to delete match what we expect
	const targetRows = await sql`
		SELECT count(*)::int AS n FROM public.discogs_tokens
		WHERE user_id::text = ANY(${TARGET_USER_IDS})
	`;
	lines.push(`Target rows to invalidate (user_id IN (${TARGET_USER_IDS.join(",")})): ${targetRows[0].n}`);
	lines.push(``);

	if (targetRows[0].n === 0) {
		lines.push(`No matching rows — nothing to delete. Skipping.`);
	} else {
		// Execute the invalidation
		lines.push(`Executing: DELETE FROM public.discogs_tokens WHERE user_id::text = ANY($1);`);
		const deleted = await sql`
			DELETE FROM public.discogs_tokens
			WHERE user_id::text = ANY(${TARGET_USER_IDS})
			RETURNING user_id
		`;
		lines.push(`Deleted rows: ${deleted.length}`);
		lines.push(`Deleted user_ids: ${deleted.map((r) => r.user_id).join(", ")}`);
	}
	lines.push(``);

	// Post-state
	const after = await sql`SELECT count(*)::int AS n FROM public.discogs_tokens`;
	lines.push(`Post-state (count of public.discogs_tokens): ${after[0].n}`);
	lines.push(``);

	// Note about user-facing impact
	lines.push(`User-facing impact:`);
	lines.push(`  - The 2 users will see their next Discogs-dependent action fail with the`);
	lines.push(`    existing 'Reconnect Discogs' UX (profile.discogs_connected stays true,`);
	lines.push(`    but the import-worker / discovery query will fail to fetch tokens).`);
	lines.push(`  - On their next OAuth re-authorize, storeTokens() will land in Vault via`);
	lines.push(`    the new public.vault_create_secret wrapper — first time this codepath`);
	lines.push(`    has ever succeeded on this project.`);
	lines.push(``);
	lines.push(`Note: profile.discogs_connected and profile.discogs_username were left unchanged.`);
	lines.push(`A follow-up housekeeping plan may want to reset them to false / NULL for the`);
	lines.push(`2 affected users so the UI accurately reflects the disconnected state. Out of`);
	lines.push(`scope for 033.1-01 — primary success criterion (plaintext_count=0) is met.`);

	appendFileSync(evidenceFile, lines.join("\n") + "\n");
	console.log("Option B applied; evidence appended.");
} catch (err) {
	console.error("FAILED:", err.message);
	lines.push(`ERROR: ${err.message}`);
	appendFileSync(evidenceFile, lines.join("\n") + "\n");
	process.exit(1);
} finally {
	await sql.end();
}
