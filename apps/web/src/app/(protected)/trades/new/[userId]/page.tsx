import { eq } from "drizzle-orm";
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { profiles } from "@/lib/db/schema/users";
import { getQuotaStatus } from "@/lib/entitlements";
import { createClient } from "@/lib/supabase/server";
import { getTradeableCollectionItems } from "@/lib/trades/proposal-queries";
import { ProposalBuilder } from "./_components/ProposalBuilder";

export const metadata: Metadata = {
	title: "New Trade \u2014 DigSwap",
	description: "Create a new trade proposal.",
};

interface NewTradePageProps {
	params: Promise<{ userId: string }>;
	searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export default async function NewTradePage({ params, searchParams }: NewTradePageProps) {
	const { userId: targetUserId } = await params;
	const rawSearch = await searchParams;
	const tradeId = typeof rawSearch.tradeId === "string" ? rawSearch.tradeId : undefined;

	const supabase = await createClient();
	const {
		data: { user },
	} = await supabase.auth.getUser();
	if (!user) redirect("/signin");

	// Can't trade with yourself
	if (targetUserId === user.id) {
		redirect("/trades");
	}

	// Fetch both collections + target profile + quota in parallel
	const [myItems, theirItems, targetProfileRow, quotaStatus] = await Promise.all([
		getTradeableCollectionItems(user.id),
		getTradeableCollectionItems(targetUserId),
		db
			.select({
				username: profiles.username,
				avatarUrl: profiles.avatarUrl,
			})
			.from(profiles)
			.where(eq(profiles.id, targetUserId))
			.limit(1),
		getQuotaStatus(user.id),
	]);

	const targetProfile = targetProfileRow[0];
	const targetUsername = targetProfile?.username ?? "Unknown User";

	return (
		<div className="max-w-5xl mx-auto px-4 py-8">
			<ProposalBuilder
				myItems={myItems}
				theirItems={theirItems}
				targetUserId={targetUserId}
				targetUsername={targetUsername}
				isPremium={quotaStatus.isPremium}
				currentUserId={user.id}
				tradeId={tradeId}
			/>
		</div>
	);
}
