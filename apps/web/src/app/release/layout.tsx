import { eq } from "drizzle-orm";
import Link from "next/link";
import { ImportBanner } from "@/components/discogs/import-banner";
import { AppShell } from "@/components/shell/app-shell";
import { db } from "@/lib/db";
import { profiles } from "@/lib/db/schema/users";
import { createClient } from "@/lib/supabase/server";

export default async function ReleaseLayout({ children }: { children: React.ReactNode }) {
	const supabase = await createClient();
	const {
		data: { user },
	} = await supabase.auth.getUser();
	// NO redirect — public route

	if (user) {
		const [profile] = await db
			.select({ displayName: profiles.displayName, avatarUrl: profiles.avatarUrl })
			.from(profiles)
			.where(eq(profiles.id, user.id))
			.limit(1);
		return (
			<AppShell
				user={{
					id: user.id,
					displayName: profile?.displayName ?? null,
					avatarUrl: profile?.avatarUrl ?? null,
				}}
				banner={<ImportBanner userId={user.id} />}
			>
				{children}
			</AppShell>
		);
	}

	return (
		<div className="min-h-screen bg-background">
			<div className="border-b border-outline-variant/20 px-4 py-2 flex items-center justify-between">
				<span className="font-mono text-xs text-primary tracking-[0.2em]">DIGSWAP_v1.0.0</span>
				<div className="flex gap-4">
					<Link
						href="/signin"
						className="font-mono text-xs text-on-surface-variant hover:text-primary transition-colors"
					>
						Sign in
					</Link>
					<Link href="/signup" className="font-mono text-xs text-primary">
						Start digging &rarr;
					</Link>
				</div>
			</div>
			{children}
		</div>
	);
}
