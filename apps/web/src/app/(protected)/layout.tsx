import { eq } from "drizzle-orm";
import { redirect } from "next/navigation";
import { ImportBanner } from "@/components/discogs/import-banner";
import { AppShell } from "@/components/shell/app-shell";
import { db } from "@/lib/db";
import { profiles } from "@/lib/db/schema/users";
import { createClient } from "@/lib/supabase/server";

export default async function ProtectedLayout({ children }: { children: React.ReactNode }) {
	const supabase = await createClient();
	const {
		data: { user },
	} = await supabase.auth.getUser();

	if (!user) {
		redirect("/signin");
	}

	const [profile] = await db
		.select({
			displayName: profiles.displayName,
			avatarUrl: profiles.avatarUrl,
			subscriptionTier: profiles.subscriptionTier,
		})
		.from(profiles)
		.where(eq(profiles.id, user.id))
		.limit(1);

	return (
		<AppShell
			user={{
				id: user.id,
				displayName: profile?.displayName ?? null,
				avatarUrl: profile?.avatarUrl ?? null,
				subscriptionTier: profile?.subscriptionTier ?? "free",
			}}
			banner={<ImportBanner userId={user.id} />}
		>
			{children}
		</AppShell>
	);
}
