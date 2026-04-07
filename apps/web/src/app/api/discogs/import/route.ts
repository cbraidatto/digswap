import { timingSafeEqual } from "node:crypto";
import { type NextRequest, NextResponse } from "next/server";
import { broadcastProgress } from "@/lib/discogs/broadcast";
import { processImportPage, processWantlistPage } from "@/lib/discogs/import-worker";
import type { ImportJobType } from "@/lib/discogs/types";
import { awardBadge } from "@/lib/gamification/badge-awards";
import { checkWantlistMatches } from "@/lib/notifications/match";
import { createAdminClient } from "@/lib/supabase/admin";

/** Vercel Pro timeout (10s on Hobby, 60s on Pro) */
export const maxDuration = 60;

/**
 * Import worker API route.
 *
 * Orchestrates page-by-page Discogs import via self-invocation pattern:
 * 1. Authenticates via IMPORT_WORKER_SECRET (internal calls only)
 * 2. Fetches the import job, transitions pending -> processing
 * 3. Processes one page of collection or wantlist
 * 4. On more pages: self-invokes for the next page (fire-and-forget)
 * 5. On collection completion: creates wantlist job and triggers it (D-07)
 * 6. On final completion: updates lastSyncedAt on profile
 */
export async function POST(request: NextRequest) {
	// 1. Authenticate via shared secret using constant-time comparison to
	//    prevent timing attacks that could leak the secret character by character.
	//    Also guards against the `Bearer undefined` bypass when the env var is unset.
	const authHeader = request.headers.get("authorization") ?? "";
	const secret = process.env.IMPORT_WORKER_SECRET;

	if (!secret) {
		console.error("[import-worker] IMPORT_WORKER_SECRET is not configured");
		return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
	}

	const expected = `Bearer ${secret}`;
	const isValid =
		authHeader.length === expected.length &&
		timingSafeEqual(Buffer.from(authHeader), Buffer.from(expected));

	if (!isValid) {
		return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
	}

	// 2. Parse request body
	let body: { jobId?: string };
	try {
		body = await request.json();
	} catch {
		return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
	}

	const { jobId } = body;
	if (!jobId) {
		return NextResponse.json({ error: "Missing jobId" }, { status: 400 });
	}

	const admin = createAdminClient();

	// 3. Fetch job to determine type and current status
	const { data: job, error: jobError } = await admin
		.from("import_jobs")
		.select("*")
		.eq("id", jobId)
		.single();

	if (jobError || !job) {
		return NextResponse.json({ error: "Job not found" }, { status: 404 });
	}

	// Already finished -- return early (idempotency guard)
	if (job.status === "completed" || job.status === "failed") {
		return NextResponse.json({ message: "Job already finished" }, { status: 200 });
	}

	// Safety: max pages limit prevents infinite self-invocation loops.
	// Discogs returns 50 items/page; 500 pages = 25,000 items (covers the largest collections).
	const MAX_PAGES = 500;
	const currentPage: number = job.current_page ?? 1;

	if (currentPage > MAX_PAGES) {
		console.error(`[import-worker] job ${jobId} exceeded ${MAX_PAGES} pages — marking as failed`);
		await admin
			.from("import_jobs")
			.update({
				status: "failed",
				error_message: `Import exceeded maximum of ${MAX_PAGES} pages`,
				completed_at: new Date().toISOString(),
			})
			.eq("id", jobId);

		return NextResponse.json({ error: "Import exceeded maximum page limit" }, { status: 200 });
	}

	// Safety: stale job timeout — if processing for over 30 minutes, mark as failed.
	// Prevents zombie jobs that block new imports indefinitely.
	const STALE_JOB_TIMEOUT_MS = 30 * 60 * 1000;
	if (job.status === "processing" && job.started_at) {
		const startedAt = new Date(job.started_at).getTime();
		if (Date.now() - startedAt > STALE_JOB_TIMEOUT_MS) {
			console.error(`[import-worker] job ${jobId} timed out after 30 minutes — marking as failed`);
			await admin
				.from("import_jobs")
				.update({
					status: "failed",
					error_message: "Import timed out after 30 minutes",
					completed_at: new Date().toISOString(),
				})
				.eq("id", jobId);

			return NextResponse.json({ error: "Import timed out" }, { status: 200 });
		}
	}

	// Transition pending -> processing on first invocation
	if (job.status === "pending") {
		await admin
			.from("import_jobs")
			.update({
				status: "processing",
				started_at: new Date().toISOString(),
			})
			.eq("id", jobId);
	}

	// 4. Process one page based on job type
	let result: {
		done: boolean;
		error?: boolean;
		jobId?: string;
		userId?: string;
		type?: ImportJobType;
		reason?: string;
	};

	if (job.type === "collection" || job.type === "sync") {
		result = await processImportPage(jobId);
	} else if (job.type === "wantlist") {
		result = await processWantlistPage(jobId);
	} else {
		return NextResponse.json({ error: `Unknown job type: ${job.type}` }, { status: 400 });
	}

	// 5. Handle completion or chain next page
	const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";

	if (result.done && !result.error) {
		// Mark job completed
		await admin
			.from("import_jobs")
			.update({
				status: "completed",
				completed_at: new Date().toISOString(),
			})
			.eq("id", jobId);

		// Re-fetch job for accurate processed/total counts
		const { data: completedJob } = await admin
			.from("import_jobs")
			.select("processed_items, total_items")
			.eq("id", jobId)
			.single();

		// Broadcast completion
		await broadcastProgress(job.user_id, {
			jobId,
			type: job.type as ImportJobType,
			status: "completed",
			processedItems: completedJob?.processed_items ?? 0,
			totalItems: completedJob?.total_items ?? 0,
			currentRecord: null,
		});

		// Badge checks after import completion (Phase 8, GAME-04)
		// Run ONCE after import completes, not per-record (performance)
		if (job.type === "collection" || job.type === "sync") {
			try {
				// Count total collection items for this user
				const { count: totalItems } = await admin
					.from("collection_items")
					.select("*", { count: "exact", head: true })
					.eq("user_id", job.user_id);

				const itemCount = totalItems ?? 0;

				// first_dig: user has at least 1 record
				if (itemCount >= 1) await awardBadge(job.user_id, "first_dig");

				// century_club: user has 100+ records
				if (itemCount >= 100) await awardBadge(job.user_id, "century_club");

				// rare_find: check if any imported record is Safira or Diamante tier (rarityScore >= 3.0)
				const { data: rareRecords } = await admin
					.from("collection_items")
					.select("release_id, releases!inner(rarity_score)")
					.eq("user_id", job.user_id)
					.gte("releases.rarity_score", 3.0)
					.limit(1);

				if (rareRecords && rareRecords.length > 0) {
					await awardBadge(job.user_id, "rare_find");
				}
			} catch (err) {
				// Non-blocking: badge check failure should not fail import completion
				console.error("Post-import badge check failed:", err);
			}
		}

		// Batch wantlist match check (Phase 6, DISC2-03)
		// Run AFTER import completes to avoid notification flood during import
		if (job.type === "collection" || job.type === "sync") {
			try {
				// Get all release IDs from this user's collection items
				// that were created/updated during this import job
				const { data: recentItems } = await admin
					.from("collection_items")
					.select("release_id")
					.eq("user_id", job.user_id)
					.eq("added_via", "discogs")
					.gte("updated_at", job.started_at || job.created_at);

				if (recentItems && recentItems.length > 0) {
					// Deduplicate release IDs
					const releaseIds = [
						...new Set(
							recentItems.map((item: { release_id: string }) => item.release_id).filter(Boolean),
						),
					];

					// Batch query: find all wantlist items matching these releases
					const { data: matches } = await admin
						.from("wantlist_items")
						.select("user_id, release_id")
						.in("release_id", releaseIds)
						.neq("user_id", job.user_id);

					if (matches && matches.length > 0) {
						// Group by release_id to avoid duplicate notifications per release
						const matchesByRelease = new Map<string, string[]>();
						for (const match of matches) {
							if (!match.release_id) continue;
							if (!matchesByRelease.has(match.release_id))
								matchesByRelease.set(match.release_id, []);
							matchesByRelease.get(match.release_id)?.push(match.user_id);
						}

						// For each matched release, create notifications
						// Cap at 50 match notifications per import to prevent email flood
						let notificationCount = 0;
						const MAX_IMPORT_NOTIFICATIONS = 50;

						for (const [releaseId] of matchesByRelease) {
							if (notificationCount >= MAX_IMPORT_NOTIFICATIONS) break;
							await checkWantlistMatches(releaseId, job.user_id);
							notificationCount++;
						}
					}
				}
			} catch (err) {
				// Non-blocking: match check failure should not fail the import completion
				console.error("Batch wantlist match check failed:", err);
			}
		}

		// If collection just completed, start wantlist import (D-07)
		if (job.type === "collection") {
			const { data: wantlistJob } = await admin
				.from("import_jobs")
				.insert({
					user_id: job.user_id,
					type: "wantlist",
					status: "pending",
					total_items: 0,
					processed_items: 0,
					current_page: 1,
					created_at: new Date().toISOString(),
				})
				.select("id")
				.single();

			if (wantlistJob) {
				// Trigger wantlist import (fire-and-forget)
				fetch(`${siteUrl}/api/discogs/import`, {
					method: "POST",
					headers: {
						"Content-Type": "application/json",
						Authorization: `Bearer ${process.env.IMPORT_WORKER_SECRET}`,
					},
					body: JSON.stringify({ jobId: wantlistJob.id }),
				}).catch(() => {
					// Fire-and-forget: wantlist job stays in pending state if this fails
				});
			}
		}

		// Update lastSyncedAt on collection/sync completion
		if (job.type === "collection" || job.type === "sync") {
			await admin
				.from("profiles")
				.update({
					last_synced_at: new Date().toISOString(),
				})
				.eq("id", job.user_id);
		}

		return NextResponse.json({ message: "Job completed" }, { status: 200 });
	}

	// More pages to process -- self-invoke for next page (fire-and-forget)
	if (!result.done) {
		fetch(`${siteUrl}/api/discogs/import`, {
			method: "POST",
			headers: {
				"Content-Type": "application/json",
				Authorization: `Bearer ${process.env.IMPORT_WORKER_SECRET}`,
			},
			body: JSON.stringify({ jobId }),
		}).catch(() => {
			// Fire-and-forget: if self-invocation fails, the job stays in
			// processing state and can be resumed by re-triggering
		});
	}

	return NextResponse.json({ message: "Page processed" }, { status: 200 });
}
