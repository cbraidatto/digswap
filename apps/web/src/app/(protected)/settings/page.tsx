import type { Metadata } from "next";
import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { DiscogsSettings } from "@/components/discogs/discogs-settings";
import { NotificationPreferences } from "./_components/notification-preferences";

export const metadata: Metadata = {
	title: "Settings — DigSwap",
	description: "Manage your account settings and integrations.",
};

/**
 * Settings page with Discogs integration section.
 *
 * Server component that fetches profile data and renders
 * the DiscogsSettings client component with current state.
 */
export default async function SettingsPage({
	searchParams,
}: {
	searchParams: Promise<{ error?: string }>;
}) {
	const supabase = await createClient();
	const {
		data: { user },
	} = await supabase.auth.getUser();

	if (!user) {
		redirect("/signin");
	}

	const admin = createAdminClient();

	const { data: profile } = await admin
		.from("profiles")
		.select("discogs_connected, discogs_username, last_synced_at")
		.eq("id", user.id)
		.single();

	const params = await searchParams;
	const oauthError = params.error || null;

	return (
		<div className="mx-auto w-full max-w-[640px] space-y-6 px-4 py-6">
			<div className="flex items-center gap-3 mb-2">
				<Link
					href="/feed"
					className="font-mono text-xs text-on-surface-variant hover:text-primary flex items-center gap-1 transition-colors"
				>
					<span className="material-symbols-outlined text-[14px]">arrow_back</span>
					BACK
				</Link>
			</div>
			<h1 className="font-heading text-xl font-semibold">Settings</h1>

			<Link
				href="/settings/billing"
				className="flex items-center justify-between bg-surface-container border border-outline-variant rounded p-4 hover:border-outline transition-colors group"
			>
				<div className="flex items-center gap-3">
					<span className="material-symbols-outlined text-muted-foreground group-hover:text-primary transition-colors text-sm">
						credit_card
					</span>
					<div>
						<div className="text-foreground font-mono text-sm">Billing</div>
						<div className="text-muted-foreground font-mono text-xs">Manage your subscription and trade quota</div>
					</div>
				</div>
				<span className="material-symbols-outlined text-outline-variant text-sm">chevron_right</span>
			</Link>

			{oauthError && <OAuthErrorBanner error={oauthError} />}

			<DiscogsSettings
				discogsConnected={profile?.discogs_connected ?? false}
				discogsUsername={profile?.discogs_username ?? null}
				lastSyncedAt={profile?.last_synced_at ?? null}
			/>

			<div className="border-t border-outline-variant/10" />

			<NotificationPreferences />
		</div>
	);
}

/**
 * Displays an OAuth error message from the callback redirect.
 * Rendered server-side as a static banner.
 */
function OAuthErrorBanner({ error }: { error: string }) {
	return (
		<div className="rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
			{error === "discogs_auth_failed"
				? "Discogs authorization failed. Please try connecting again from Settings."
				: "Could not connect to Discogs. Please try again."}
		</div>
	);
}
