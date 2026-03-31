/**
 * One-time data migration script: Generates usernames for existing profiles.
 *
 * For each profile where username IS NULL:
 * - Derives from displayName: lowercase, hyphens for spaces, alphanumeric only, max 26 chars
 * - Appends -XXXX random suffix
 * - Falls back to "digger-XXXX" if displayName is empty
 *
 * Run: npx tsx scripts/migrate-usernames.ts
 */

import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

if (!supabaseUrl || !serviceRoleKey) {
	console.error(
		"Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY",
	);
	process.exit(1);
}

const admin = createClient(supabaseUrl, serviceRoleKey, {
	auth: { autoRefreshToken: false, persistSession: false },
});

function generateUsername(displayName: string | null): string {
	const suffix = Math.floor(1000 + Math.random() * 9000).toString();

	if (!displayName || displayName.trim().length === 0) {
		return `digger-${suffix}`;
	}

	const base = displayName
		.toLowerCase()
		.replace(/\s+/g, "-")
		.replace(/[^a-z0-9-]/g, "")
		.replace(/-+/g, "-")
		.replace(/^-|-$/g, "")
		.slice(0, 26);

	if (base.length === 0) {
		return `digger-${suffix}`;
	}

	return `${base}-${suffix}`;
}

async function main() {
	console.log("Fetching profiles without usernames...");

	const { data: profiles, error } = await admin
		.from("profiles")
		.select("id, display_name")
		.is("username", null);

	if (error) {
		console.error("Failed to fetch profiles:", error);
		process.exit(1);
	}

	if (!profiles || profiles.length === 0) {
		console.log("All profiles already have usernames. Nothing to do.");
		return;
	}

	console.log(`Found ${profiles.length} profiles to update.`);

	let updated = 0;
	let failed = 0;

	for (const profile of profiles) {
		const username = generateUsername(profile.display_name);

		const { error: updateError } = await admin
			.from("profiles")
			.update({ username, updated_at: new Date().toISOString() })
			.eq("id", profile.id);

		if (updateError) {
			console.error(
				`Failed to update profile ${profile.id}:`,
				updateError,
			);
			failed++;
		} else {
			console.log(
				`  ${profile.display_name || "(no name)"} -> ${username}`,
			);
			updated++;
		}
	}

	console.log(
		`\nDone. Updated: ${updated}, Failed: ${failed}, Total: ${profiles.length}`,
	);
}

main().catch(console.error);
