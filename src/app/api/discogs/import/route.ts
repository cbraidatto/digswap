import { type NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import {
	processImportPage,
	processWantlistPage,
} from "@/lib/discogs/import-worker";
import { broadcastProgress } from "@/lib/discogs/broadcast";
import type { ImportJobType } from "@/lib/discogs/types";

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
	// 1. Authenticate via shared secret
	const authHeader = request.headers.get("authorization");
	const expectedToken = `Bearer ${process.env.IMPORT_WORKER_SECRET}`;

	if (!authHeader || authHeader !== expectedToken) {
		return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
	}

	// 2. Parse request body
	let body: { jobId?: string };
	try {
		body = await request.json();
	} catch {
		return NextResponse.json(
			{ error: "Invalid request body" },
			{ status: 400 },
		);
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
		return NextResponse.json(
			{ message: "Job already finished" },
			{ status: 200 },
		);
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
		return NextResponse.json(
			{ error: `Unknown job type: ${job.type}` },
			{ status: 400 },
		);
	}

	// 5. Handle completion or chain next page
	const siteUrl =
		process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";

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

		return NextResponse.json(
			{ message: "Job completed" },
			{ status: 200 },
		);
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
