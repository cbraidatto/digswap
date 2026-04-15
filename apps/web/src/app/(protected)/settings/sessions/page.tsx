import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { SessionList } from "@/components/settings/session-list";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = {
	title: "Active sessions — DigSwap",
	description: "View and manage your active login sessions.",
};

/**
 * Active Sessions settings page.
 *
 * Server Component -- performs auth check and renders SessionList client component.
 * Part of the settings section (protected route).
 *
 * Note: This page will be integrated into a full settings layout in Phase 2.
 * For now, it's a standalone page.
 */
export default async function SessionsPage() {
	const supabase = await createClient();
	const { data, error } = await supabase.auth.getUser();

	if (error || !data.user) {
		redirect("/signin");
	}

	return (
		<div className="flex min-h-dvh flex-col items-center bg-background px-4 py-8">
			<div className="w-full max-w-[600px] space-y-6">
				<Link
					href="/settings"
					className="font-mono text-xs text-on-surface-variant hover:text-primary flex items-center gap-1 transition-colors"
				>
					<span className="material-symbols-outlined text-[14px]">arrow_back</span>
					SETTINGS
				</Link>
				<div>
					<h1 className="font-heading text-2xl font-semibold tracking-[-0.02em] text-foreground">
						Active Sessions
					</h1>
					<p className="mt-1 text-sm text-muted-foreground">
						Manage your active sessions across devices. You can have up to 3 simultaneous sessions.
					</p>
				</div>

				<SessionList />
			</div>
		</div>
	);
}
