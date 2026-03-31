import { eq } from "drizzle-orm";
import { redirect } from "next/navigation";
import type { ReactNode } from "react";
import { db } from "@/lib/db";
import { profiles } from "@/lib/db/schema/users";
import { createClient } from "@/lib/supabase/server";

/**
 * Onboarding layout -- Server Component.
 *
 * Guards:
 * 1. Redirects to /signin if not authenticated (backup to middleware)
 * 2. Redirects to / if onboarding is already completed
 *
 * Layout: Full viewport height centered with DigSwap wordmark.
 * Same visual pattern as the auth layout.
 */
export default async function OnboardingLayout({ children }: { children: ReactNode }) {
	const supabase = await createClient();
	const {
		data: { user },
	} = await supabase.auth.getUser();

	if (!user) {
		redirect("/signin");
	}

	// Check if onboarding already completed
	const [profile] = await db
		.select({ onboardingCompleted: profiles.onboardingCompleted })
		.from(profiles)
		.where(eq(profiles.id, user.id))
		.limit(1);

	if (profile?.onboardingCompleted) {
		redirect("/feed");
	}

	return (
		<div className="flex min-h-dvh flex-col items-center justify-center bg-background px-4 py-8">
			<div className="mb-8">
				<h1 className="font-heading text-[28px] font-normal tracking-[-0.03em] leading-[1.1] text-foreground sm:text-[36px]">
					Vinyl<span className="text-primary">Dig</span>
				</h1>
			</div>
			<div className="w-full max-w-[520px]">{children}</div>
		</div>
	);
}
