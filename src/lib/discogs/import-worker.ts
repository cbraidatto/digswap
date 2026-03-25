import { createAdminClient } from "@/lib/supabase/admin";
import { createDiscogsClient, computeRarityScore } from "./client";
import { broadcastProgress } from "./broadcast";
import type { ImportJobStatus, ImportJobType } from "./types";

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

/**
 * Upserts a release into the releases table via admin client and returns its UUID.
 * Uses discogs_id as the conflict key.
 */
async function upsertRelease(
	admin: ReturnType<typeof createAdminClient>,
	item: {
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
	},
): Promise<string | null> {
	const info = item.basic_information;
	const have = item.community?.have ?? 0;
	const want = item.community?.want ?? 0;

	const releaseData = {
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
		updated_at: new Date().toISOString(),
	};

	const { error: upsertError } = await admin
		.from("releases")
		.upsert(releaseData, { onConflict: "discogs_id" });

	if (upsertError) {
		console.error(
			`Release upsert failed for discogs_id ${info.id}:`,
			upsertError,
		);
		return null;
	}

	// Fetch the release UUID after upsert
	const { data: releaseRow, error: fetchError } = await admin
		.from("releases")
		.select("id")
		.eq("discogs_id", info.id)
		.single();

	if (fetchError || !releaseRow) {
		console.error(
			`Failed to fetch release UUID for discogs_id ${info.id}:`,
			fetchError,
		);
		return null;
	}

	return releaseRow.id;
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
				error_message:
					"Collection exceeds maximum import size (20,000+ items)",
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

		// Get Discogs identity for username
		const identity = await client.getIdentity();
		const username = identity.data.username;

		// Fetch one page of collection (folder 0 = all items)
		const response = await client
			.user()
			.collection()
			.getReleases(username, 0, {
				page: currentPage,
				per_page: 100,
				sort: "added",
				sort_order: "desc",
			});

		const releases = response.data.releases ?? [];
		const pagination = response.data.pagination;
		let processed = job.processed_items ?? 0;
		let lastItemTitle: string | null = null;

		// Process each release in the page
		for (const item of releases) {
			const releaseId = await upsertRelease(admin, item);

			if (releaseId) {
				// Insert collection item via admin client
				// Use select-then-insert to avoid duplicates (no unique constraint on user_id + discogs_instance_id)
				const { data: existing } = await admin
					.from("collection_items")
					.select("id")
					.eq("user_id", job.user_id)
					.eq("discogs_instance_id", item.instance_id)
					.maybeSingle();

				if (!existing) {
					await admin.from("collection_items").insert({
						user_id: job.user_id,
						release_id: releaseId,
						discogs_instance_id: item.instance_id,
						added_via: "discogs",
						created_at:
							(item as unknown as { date_added?: string }).date_added || new Date().toISOString(),
						updated_at: new Date().toISOString(),
					});
				} else {
					// Update existing item to refresh the release link
					await admin
						.from("collection_items")
						.update({
							release_id: releaseId,
							updated_at: new Date().toISOString(),
						})
						.eq("id", existing.id);
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
		const errorMessage =
			error instanceof Error ? error.message : "Unknown error";
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
				error_message:
					"Wantlist exceeds maximum import size (20,000+ items)",
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

		// Get Discogs identity for username
		const identity = await client.getIdentity();
		const username = identity.data.username;

		// Fetch one page of wantlist
		const response = await client
			.user()
			.wantlist()
			.getReleases(username, { page: currentPage, per_page: 100 });

		const wants = response.data.wants ?? [];
		const pagination = response.data.pagination;
		let processed = job.processed_items ?? 0;
		let lastItemTitle: string | null = null;

		// Process each wantlist item
		for (const item of wants) {
			const releaseId = await upsertRelease(admin, item);

			if (releaseId) {
				// Check for existing wantlist item to avoid duplicates
				const { data: existing } = await admin
					.from("wantlist_items")
					.select("id")
					.eq("user_id", job.user_id)
					.eq("release_id", releaseId)
					.maybeSingle();

				if (!existing) {
					await admin.from("wantlist_items").insert({
						user_id: job.user_id,
						release_id: releaseId,
						added_via: "discogs",
						priority: 0,
						created_at: new Date().toISOString(),
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
		const errorMessage =
			error instanceof Error ? error.message : "Unknown error";
		console.error(
			`Wantlist page processing failed for job ${jobId}:`,
			error,
		);

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
