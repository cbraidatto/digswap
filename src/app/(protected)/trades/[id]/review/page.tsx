import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getTradeById } from "@/lib/trades/queries";
import { createAdminClient } from "@/lib/supabase/admin";
import { SpecAnalysis } from "./_components/spec-analysis";

interface TradeReviewPageProps {
	params: Promise<{ id: string }>;
}

export default async function TradeReviewPage({ params }: TradeReviewPageProps) {
	const { id: tradeId } = await params;

	// Auth check
	const supabase = await createClient();
	const {
		data: { user },
	} = await supabase.auth.getUser();

	if (!user) redirect("/signin");

	// Fetch trade, verify participant
	const trade = await getTradeById(tradeId, user.id);
	if (!trade) redirect("/trades");

	// Check subscription for premium features
	const admin = createAdminClient();
	const { data: sub } = await admin
		.from("subscriptions")
		.select("plan")
		.eq("user_id", user.id)
		.maybeSingle();

	const isPremium = sub?.plan === "premium" || sub?.plan === "pro";

	return (
		<div className="max-w-4xl mx-auto px-4 md:px-8 py-8">
			<div className="mb-8">
				<span className="text-[10px] font-mono text-primary tracking-[0.2em] uppercase">
					Protocol / Trade / Review
				</span>
				<h1 className="text-3xl font-bold font-heading text-on-surface mt-1 uppercase">
					SPEC_CHECK
				</h1>
				<p className="text-on-surface-variant font-mono text-xs mt-2">
					Verify audio file quality before accepting the trade.
				</p>
			</div>

			<SpecAnalysis
				tradeId={trade.id}
				declaredMetadata={{
					fileFormat: trade.fileFormat,
					declaredBitrate: trade.declaredBitrate,
					fileName: trade.fileName,
				}}
				isPremium={isPremium}
			/>
		</div>
	);
}
