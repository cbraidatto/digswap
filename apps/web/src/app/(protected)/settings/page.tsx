import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { DiscogsSettings } from "@/components/discogs/discogs-settings";
import { NotificationPreferences } from "./_components/notification-preferences";

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
			<h1 className="font-heading text-xl font-semibold">Settings</h1>

			<Link
				href="/settings/billing"
				className="flex items-center justify-between bg-[#111008] border border-[#2a2218] rounded p-4 hover:border-[#3a3228] transition-colors group"
			>
				<div className="flex items-center gap-3">
					<span className="material-symbols-outlined text-[#4a4035] group-hover:text-[#c8914a] transition-colors text-sm">
						credit_card
					</span>
					<div>
						<div className="text-[#e8dcc8] font-mono text-sm">Billing</div>
						<div className="text-[#4a4035] font-mono text-xs">Manage your subscription and trade quota</div>
					</div>
				</div>
				<span className="material-symbols-outlined text-[#2a2218] text-sm">chevron_right</span>
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
