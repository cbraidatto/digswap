"use server";

import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getRequestToken, deleteTokens } from "@/lib/discogs/oauth";
import { discogsRateLimit } from "@/lib/rate-limit";

/**
 * Initiate Discogs OAuth 1.0a connection flow.
 *
 * Flow:
 * 1. Verify user is authenticated
 * 2. Request a temporary token from Discogs
 * 3. Store the request token in an httpOnly cookie (10 min TTL)
 * 4. Return the Discogs authorizeUrl for the client to navigate to
 *
 * NOTE: redirect() from next/navigation cannot be used here because
 * Next.js Server Actions process redirects via router.push() internally,
 * which only works for same-origin paths. External URLs (discogs.com) are
 * silently dropped, causing POST 200 with no navigation. The caller must
 * do window.location.href = url to perform a full browser navigation.
 */
export async function connectDiscogs(): Promise<{ url: string } | { error: string }> {
	try {
		const supabase = await createClient();
		const {
			data: { user },
		} = await supabase.auth.getUser();

		if (!user) {
			return { error: "Not authenticated" };
		}

		const { success: rlSuccess } = await discogsRateLimit.limit(user.id);
		if (!rlSuccess) {
			return { error: "Too many requests. Please wait a moment." };
		}

		const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";
		const callbackUrl = `${siteUrl}/api/discogs/callback`;

		const { token, tokenSecret, authorizeUrl } =
			await getRequestToken(callbackUrl);

		// Store request token in httpOnly cookie for the callback.
		// sameSite: "lax" allows the cookie to survive the redirect back from Discogs.
		// maxAge: 600 (10 minutes) prevents stale tokens from lingering.
		const cookieStore = await cookies();
		cookieStore.set(
			"discogs_oauth",
			JSON.stringify({ token, tokenSecret }),
			{
				httpOnly: true,
				secure: process.env.NODE_ENV === "production",
				sameSite: "lax",
				maxAge: 600,
				path: "/",
			},
		);

		return { url: authorizeUrl };
	} catch (err) {
		console.error("[connectDiscogs] error:", err);
		return { error: "Failed to connect to Discogs. Please try again." };
	}
}

/**
 * Trigger a delta sync of the user's Discogs collection.
 *
 * Creates a "sync" type import job and fires the import worker.
 * Prevents duplicate jobs by checking for existing active imports.
 *
 * Per D-11 (delta sync strategy), D-13 (sync button in Settings).
 */
export async function triggerSync(): Promise<{
	success?: boolean;
	error?: string;
}> {
	try {
		const supabase = await createClient();
		const {
			data: { user },
		} = await supabase.auth.getUser();

		if (!user) {
			return { error: "Not authenticated" };
		}

		const { success: rlSuccess } = await discogsRateLimit.limit(user.id);
		if (!rlSuccess) {
			return { error: "Too many requests. Please wait a moment." };
		}

		const admin = createAdminClient();

		// Check for existing active import/sync job (prevent duplicates)
		const { data: existingJobs } = await admin
			.from("import_jobs")
			.select("id")
			.eq("user_id", user.id)
			.in("status", ["pending", "processing"])
			.limit(1);

		if (existingJobs && existingJobs.length > 0) {
			return { error: "An import is already in progress." };
		}

		// Create sync job
		const { data: job, error } = await admin
			.from("import_jobs")
			.insert({
				user_id: user.id,
				type: "sync",
				status: "pending",
				total_items: 0,
				processed_items: 0,
				current_page: 1,
				created_at: new Date().toISOString(),
			})
			.select("id")
			.single();

		if (error || !job) {
			return { error: "Could not start sync." };
		}

		// Trigger import worker (fire-and-forget)
		const siteUrl =
			process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";
		fetch(`${siteUrl}/api/discogs/import`, {
			method: "POST",
			headers: {
				"Content-Type": "application/json",
				Authorization: `Bearer ${process.env.IMPORT_WORKER_SECRET}`,
			},
			body: JSON.stringify({ jobId: job.id }),
		}).catch(() => {});

		return { success: true };
	} catch (err) {
		console.error("[triggerSync] error:", err);
		return { error: "Failed to start sync. Please try again." };
	}
}

/**
 * Disconnect Discogs from the user's account.
 *
 * Hard delete per D-14:
 * 1. Cancel any active import jobs
 * 2. Delete collection items sourced from Discogs
 * 3. Delete wantlist items sourced from Discogs
 * 4. Clear profile Discogs fields
 * 5. Delete stored OAuth tokens
 *
 * IMPORTANT: Does NOT delete from the `releases` table.
 * Releases are shared across users.
 */
export async function disconnectDiscogs(): Promise<{
	success?: boolean;
	error?: string;
}> {
	try {
		const supabase = await createClient();
		const {
			data: { user },
		} = await supabase.auth.getUser();

		if (!user) {
			return { error: "Not authenticated" };
		}

		const { success: rlSuccess } = await discogsRateLimit.limit(user.id);
		if (!rlSuccess) {
			return { error: "Too many requests. Please wait a moment." };
		}

		const admin = createAdminClient();

		// 1. Cancel any active import jobs
		await admin
			.from("import_jobs")
			.update({
				status: "failed",
				error_message: "Disconnected by user",
				completed_at: new Date().toISOString(),
			})
			.eq("user_id", user.id)
			.in("status", ["pending", "processing"]);

		// 2. Delete collection items sourced from Discogs
		await admin
			.from("collection_items")
			.delete()
			.eq("user_id", user.id)
			.eq("added_via", "discogs");

		// 3. Delete wantlist items sourced from Discogs
		await admin
			.from("wantlist_items")
			.delete()
			.eq("user_id", user.id)
			.eq("added_via", "discogs");

		// 4. Clear profile Discogs fields
		await admin
			.from("profiles")
			.update({
				discogs_connected: false,
				discogs_username: null,
				last_synced_at: null,
				updated_at: new Date().toISOString(),
			})
			.eq("id", user.id);

		// 5. Delete stored tokens
		await deleteTokens(user.id);

		return { success: true };
	} catch (err) {
		console.error("[disconnectDiscogs] error:", err);
		return { error: "Could not disconnect. Please try again." };
	}
}

/**
 * Reset and re-import the user's Discogs collection from scratch.
 *
 * Per D-12:
 * 1. Check for active jobs (prevent duplicates)
 * 2. Delete all Discogs-sourced collection and wantlist items
 * 3. Create a fresh "collection" import job
 * 4. Trigger the import worker
 *
 * On success, redirects to /import-progress.
 */
export async function triggerReimport(): Promise<{
	success?: boolean;
	error?: string;
	redirectTo?: string;
}> {
	try {
		const supabase = await createClient();
		const {
			data: { user },
		} = await supabase.auth.getUser();

		if (!user) {
			return { error: "Not authenticated" };
		}

		const { success: rlSuccess } = await discogsRateLimit.limit(user.id);
		if (!rlSuccess) {
			return { error: "Too many requests. Please wait a moment." };
		}

		const admin = createAdminClient();

		// Check for existing active job
		const { data: existingJobs } = await admin
			.from("import_jobs")
			.select("id")
			.eq("user_id", user.id)
			.in("status", ["pending", "processing"])
			.limit(1);

		if (existingJobs && existingJobs.length > 0) {
			return { error: "An import is already in progress." };
		}

		// Delete existing Discogs-sourced items (clean slate)
		await admin
			.from("collection_items")
			.delete()
			.eq("user_id", user.id)
			.eq("added_via", "discogs");

		await admin
			.from("wantlist_items")
			.delete()
			.eq("user_id", user.id)
			.eq("added_via", "discogs");

		// Create fresh collection import job
		const { data: job } = await admin
			.from("import_jobs")
			.insert({
				user_id: user.id,
				type: "collection",
				status: "pending",
				total_items: 0,
				processed_items: 0,
				current_page: 1,
				created_at: new Date().toISOString(),
			})
			.select("id")
			.single();

		if (job) {
			const siteUrl =
				process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";
			fetch(`${siteUrl}/api/discogs/import`, {
				method: "POST",
				headers: {
					"Content-Type": "application/json",
					Authorization: `Bearer ${process.env.IMPORT_WORKER_SECRET}`,
				},
				body: JSON.stringify({ jobId: job.id }),
			}).catch(() => {});
		}

		return { success: true, redirectTo: "/import-progress" };
	} catch (err) {
		console.error("[triggerReimport] error:", err);
		return { error: "Failed to start re-import. Please try again." };
	}
}
