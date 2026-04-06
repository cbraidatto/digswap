import "server-only";

import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { ImportProgress } from "@/components/discogs/import-progress";

export const metadata: Metadata = {
	title: "Import progress — DigSwap",
	description: "Track the progress of your Discogs collection import.",
};

export default async function ImportProgressPage() {
	const supabase = await createClient();
	const {
		data: { user },
	} = await supabase.auth.getUser();

	if (!user) {
		redirect("/signin");
	}

	// Fetch the most recent import job for this user using admin client (bypasses RLS)
	const admin = createAdminClient();
	const { data: job } = await admin
		.from("import_jobs")
		.select("id, type, status, processed_items, total_items, current_record")
		.eq("user_id", user.id)
		.order("created_at", { ascending: false })
		.limit(1)
		.single();

	const initialJob = job
		? {
				id: job.id as string,
				type: job.type as string,
				status: job.status as string,
				processedItems: (job.processed_items as number) ?? 0,
				totalItems: (job.total_items as number) ?? 0,
				currentRecord: (job.current_record as string | null) ?? null,
			}
		: null;

	return <ImportProgress userId={user.id} initialJob={initialJob} />;
}
