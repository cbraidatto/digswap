import { createAdminClient } from "@/lib/supabase/admin";
import { broadcastProgress } from "./broadcast";
import { computeRarityScore, createDiscogsClient } from "./client";
import type { ImportJobStatus, ImportJobType } from "./types";

/**
 * Retry helper with exponential backoff for Discogs API rate limits (HTTP 429).
 * Only retries on 429 errors; all other errors are thrown immediately.
 */
async function withRetry<T>(fn: () => Promise<T>, maxRetries = 3): Promise<T> {
	for (let attempt = 0; attempt <= maxRetries; attempt++) {
		try {
			return await fn();
		} catch (error: unknown) {
			const isRateLimit =
				(error instanceof Error && error.message?.includes("429")) ||
				(typeof error === "object" &&
					error !== null &&
					"statusCode" in error &&
					(error as { statusCode: number }).statusCode === 429);
			if (!isRateLimit || attempt === maxRetries) throw error;
			const delay = Math.min(1000 * 2 ** attempt, 10000);
			await new Promise((r) => setTimeout(r, delay));
		}
	}
	throw new Error("withRetry: unreachable");
}

/** Max pages to process before marking job as failed (safety limit: 20,000+ items) */
const MAX_PAGES = 200;

interface PageResult {
	done: boolean;
	error?: boolean;
	jobId?: string;
	userId?: string;
	type?: ImportJobType;
	reason?: string;
}

/** Shape of a Discogs item used in both collection and wantlist imports */
interface DiscogsItem {
	basic_information: {
		id: number;
		title: string;
		artists?: Array<{ name: string }>;
		year?: number;
		genres?: string[];
		styles?: string[];
		formats?: Array<{ name: string }>;
		cover_image?: string;
		thumb?: string;
	};
	community?: { have?: number; want?: number };
}

/**
 * Batch upserts releases into the releases table and returns a Map of discogs_id -> UUID.
 * Processes in batches of BATCH_SIZE to stay within PostgREST limits.
 */
const BATCH_SIZE = 50;

async function batchUpsertReleases(
	admin: ReturnType<typeof createAdminClient>,
	items: DiscogsItem[],
): Promise<Map<number, string>> {
	const discogsIdToUuid = new Map<number, string>();

	for (let i = 0; i < items.length; i += BATCH_SIZE) {
		const batch = items.slice(i, i + BATCH_SIZE);
		const now = new Date().toISOString();

		const releaseRows = batch.map((item) => {
			const info = item.basic_information;
			const have = item.community?.have ?? 0;
			const want = item.community?.want ?? 0;
			return {
				discogs_id: info.id,
				title: info.title,
				artist: info.artists?.[0]?.name ?? "Unknown",
				year: info.year || null,
				genre: info.genres || [],
				style: info.styles || [],
				format: info.formats?.[0]?.name || null,
				cover_image_url: info.cover_image || info.thumb || null,
				discogs_have: have,
				discogs_want: want,
				rarity_score: computeRarityScore(have, want),
				updated_at: now,
			};
		});

		const { data, error } = await admin
			.from("releases")
			.upsert(releaseRows, { onConflict: "discogs_id" })
			.select("id, discogs_id");

		if (error) {
			console.error("Batch release upsert failed:", error);
			continue;
		}

		if (data) {
			for (const row of data) {
				discogsIdToUuid.set(row.discogs_id, row.id);
			}
		}
	}

	return discogsIdToUuid;
}

/**
 * Processes one page of a user's Discogs collection.
 *
 * Fetches 100 items per page, upserts releases, creates collection_items,
 * updates the import job progress, and broadcasts status via Realtime.
 *
 * Returns { done: true } when all pages processed or an error occurs.
 */
export async function processImportPage(jobId: string): Promise<PageResult> {
	const admin = createAdminClient();

	// Fetch the import job
	const { data: job, error: jobError } = await admin
		.from("import_jobs")
		.select("*")
		.eq("id", jobId)
		.single();

	if (jobError || !job) {
		console.error("Import job not found:", jobId, jobError);
		return { done: true, reason: "job-not-found" };
	}

	if (job.status !== "processing") {
		return { done: true, reason: "not-processing" };
	}

	// Update started_at on first invocation
	if (!job.started_at) {
		await admin
			.from("import_jobs")
			.update({ started_at: new Date().toISOString() })
			.eq("id", jobId);
	}

	const currentPage: number = job.current_page ?? 1;

	// Safety limit: prevent runaway imports of extremely large collections
	if (currentPage > MAX_PAGES) {
		await admin
			.from("import_jobs")
			.update({
				status: "failed" as ImportJobStatus,
				error_message: "Collection exceeds maximum import size (20,000+ items)",
				completed_at: new Date().toISOString(),
			})
			.eq("id", jobId);

		await broadcastProgress(job.user_id, {
			jobId,
			type: job.type as ImportJobType,
			status: "failed",
			processedItems: job.processed_items ?? 0,
			totalItems: job.total_items ?? 0,
			currentRecord: null,
		});

		return { done: true, error: true };
	}

	try {
		// Create authenticated Discogs client
		const client = await createDiscogsClient(job.user_id);

		// Get Discogs identity for username (retry on 429 rate limit)
		const identity = await withRetry(() => client.getIdentity());
		const username = identity.data.username;

		// Fetch one page of collection (folder 0 = all items, retry on 429 rate limit)
		const response = await withRetry(() =>
			client.user().collection().getReleases(username, 0, {
				page: currentPage,
				per_page: 100,
				sort: "added",
				sort_order: "desc",
			}),
		);

		const releases = response.data.releases ?? [];
		const pagination = response.data.pagination;
		let processed = job.processed_items ?? 0;
		let lastItemTitle: string | null = null;

		// Batch upsert all releases in the page (reduces N queries to ceil(N/50))
		const releaseIdMap = await batchUpsertReleases(admin, releases);

		// Process collection_items per-item: partial unique index
		// (WHERE discogs_instance_id IS NOT NULL) is incompatible with PostgREST
		// upsert, so we must select-then-insert/update individually.
		for (const item of releases) {
			const releaseId = releaseIdMap.get(item.basic_information.id) ?? null;

			if (releaseId) {
				const { data: existing } = await admin
					.from("collection_items")
					.select("id")
					.eq("user_id", job.user_id)
					.eq("discogs_instance_id", item.instance_id)
					.maybeSingle();

				if (existing) {
					await admin
						.from("collection_items")
						.update({
							release_id: releaseId,
							updated_at: new Date().toISOString(),
						})
						.eq("id", existing.id);
				} else {
					await admin.from("collection_items").insert({
						user_id: job.user_id,
						release_id: releaseId,
						discogs_instance_id: item.instance_id,
						added_via: "discogs",
						created_at:
							(item as unknown as { date_added?: string }).date_added || new Date().toISOString(),
						updated_at: new Date().toISOString(),
					});
				}
			}

			processed++;
			lastItemTitle = `${item.basic_information.title} -- ${item.basic_information.artists?.[0]?.name ?? "Unknown"}`;
		}

		// Update job progress
		await admin
			.from("import_jobs")
			.update({
				processed_items: processed,
				current_page: currentPage + 1,
				total_items: pagination.items,
				total_pages: pagination.pages,
				current_record: lastItemTitle,
			})
			.eq("id", jobId);

		// Broadcast progress
		await broadcastProgress(job.user_id, {
			jobId,
			type: job.type as ImportJobType,
			status: "processing",
			processedItems: processed,
			totalItems: pagination.items,
			currentRecord: lastItemTitle,
		});

		const done = currentPage >= pagination.pages;
		return {
			done,
			jobId,
			userId: job.user_id,
			type: job.type as ImportJobType,
		};
	} catch (error) {
		const errorMessage = error instanceof Error ? error.message : "Unknown error";
		console.error(`Import page processing failed for job ${jobId}:`, error);

		// Mark job as failed
		await admin
			.from("import_jobs")
			.update({
				status: "failed" as ImportJobStatus,
				error_message: errorMessage,
				completed_at: new Date().toISOString(),
			})
			.eq("id", jobId);

		// Broadcast failure
		await broadcastProgress(job.user_id, {
			jobId,
			type: job.type as ImportJobType,
			status: "failed",
			processedItems: job.processed_items ?? 0,
			totalItems: job.total_items ?? 0,
			currentRecord: null,
		});

		return { done: true, error: true };
	}
}

/**
 * Processes one page of a user's Discogs wantlist.
 *
 * Same pattern as processImportPage but targets the wantlist endpoint
 * and inserts into wantlist_items instead of collection_items.
 */
export async function processWantlistPage(jobId: string): Promise<PageResult> {
	const admin = createAdminClient();

	// Fetch the import job
	const { data: job, error: jobError } = await admin
		.from("import_jobs")
		.select("*")
		.eq("id", jobId)
		.single();

	if (jobError || !job) {
		console.error("Wantlist import job not found:", jobId, jobError);
		return { done: true, reason: "job-not-found" };
	}

	if (job.status !== "processing") {
		return { done: true, reason: "not-processing" };
	}

	// Update started_at on first invocation
	if (!job.started_at) {
		await admin
			.from("import_jobs")
			.update({ started_at: new Date().toISOString() })
			.eq("id", jobId);
	}

	const currentPage: number = job.current_page ?? 1;

	// Safety limit
	if (currentPage > MAX_PAGES) {
		await admin
			.from("import_jobs")
			.update({
				status: "failed" as ImportJobStatus,
				error_message: "Wantlist exceeds maximum import size (20,000+ items)",
				completed_at: new Date().toISOString(),
			})
			.eq("id", jobId);

		await broadcastProgress(job.user_id, {
			jobId,
			type: job.type as ImportJobType,
			status: "failed",
			processedItems: job.processed_items ?? 0,
			totalItems: job.total_items ?? 0,
			currentRecord: null,
		});

		return { done: true, error: true };
	}

	try {
		// Create authenticated Discogs client
		const client = await createDiscogsClient(job.user_id);

		// Get Discogs identity for username (retry on 429 rate limit)
		const identity = await withRetry(() => client.getIdentity());
		const username = identity.data.username;

		// Fetch one page of wantlist (retry on 429 rate limit)
		const response = await withRetry(() =>
			client.user().wantlist().getReleases(username, { page: currentPage, per_page: 100 }),
		);

		const wants = response.data.wants ?? [];
		const pagination = response.data.pagination;
		let processed = job.processed_items ?? 0;
		let lastItemTitle: string | null = null;

		// Batch upsert all releases in the page (reduces N queries to ceil(N/50))
		const releaseIdMap = await batchUpsertReleases(admin, wants);

		// Collect release IDs that were successfully upserted
		const resolvedReleaseIds = [...releaseIdMap.values()];

		// Batch check: find which wantlist_items already exist for this user
		const existingWantlistSet = new Set<string>();
		if (resolvedReleaseIds.length > 0) {
			const { data: existingItems } = await admin
				.from("wantlist_items")
				.select("release_id")
				.eq("user_id", job.user_id)
				.in("release_id", resolvedReleaseIds);

			if (existingItems) {
				for (const row of existingItems) {
					existingWantlistSet.add(row.release_id);
				}
			}
		}

		// Batch insert new wantlist items (skip duplicates)
		const now = new Date().toISOString();
		const newWantlistItems: Array<{
			user_id: string;
			release_id: string;
			added_via: string;
			priority: number;
			created_at: string;
		}> = [];

		for (const item of wants) {
			const releaseId = releaseIdMap.get(item.basic_information.id) ?? null;
			if (releaseId && !existingWantlistSet.has(releaseId)) {
				newWantlistItems.push({
					user_id: job.user_id,
					release_id: releaseId,
					added_via: "discogs",
					priority: 0,
					created_at: now,
				});
			}
			processed++;
			lastItemTitle = `${item.basic_information.title} -- ${item.basic_information.artists?.[0]?.name ?? "Unknown"}`;
		}

		// Insert in batches of BATCH_SIZE
		for (let i = 0; i < newWantlistItems.length; i += BATCH_SIZE) {
			const batch = newWantlistItems.slice(i, i + BATCH_SIZE);
			await admin.from("wantlist_items").insert(batch);
		}

		// Update job progress
		await admin
			.from("import_jobs")
			.update({
				processed_items: processed,
				current_page: currentPage + 1,
				total_items: pagination.items,
				total_pages: pagination.pages,
				current_record: lastItemTitle,
			})
			.eq("id", jobId);

		// Broadcast progress
		await broadcastProgress(job.user_id, {
			jobId,
			type: job.type as ImportJobType,
			status: "processing",
			processedItems: processed,
			totalItems: pagination.items,
			currentRecord: lastItemTitle,
		});

		const done = currentPage >= pagination.pages;
		return {
			done,
			jobId,
			userId: job.user_id,
			type: job.type as ImportJobType,
		};
	} catch (error) {
		const errorMessage = error instanceof Error ? error.message : "Unknown error";
		console.error(`Wantlist page processing failed for job ${jobId}:`, error);

		// Mark job as failed
		await admin
			.from("import_jobs")
			.update({
				status: "failed" as ImportJobStatus,
				error_message: errorMessage,
				completed_at: new Date().toISOString(),
			})
			.eq("id", jobId);

		// Broadcast failure
		await broadcastProgress(job.user_id, {
			jobId,
			type: job.type as ImportJobType,
			status: "failed",
			processedItems: job.processed_items ?? 0,
			totalItems: job.total_items ?? 0,
			currentRecord: null,
		});

		return { done: true, error: true };
	}
}
