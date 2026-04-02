import { createClient } from "@/lib/supabase/server";
import { PricingCards } from "./_components/PricingCards";
import type { SubscriptionPlan } from "@/lib/stripe";

export const metadata = {
	title: "Pricing — DigSwap",
	description: "Choose your dig level. Free forever or go Premium for unlimited trades.",
};

async function getCurrentPlan(userId: string): Promise<SubscriptionPlan | null> {
	const { createAdminClient } = await import("@/lib/supabase/admin");
	const admin = createAdminClient();
	const { data } = await admin
		.from("subscriptions")
		.select("plan")
		.eq("user_id", userId)
		.maybeSingle();
	return (data?.plan as SubscriptionPlan) ?? null;
}

export default async function PricingPage() {
	// Optional auth — show current plan state if signed in, don't block if not
	const supabase = await createClient();
	const {
		data: { user },
	} = await supabase.auth.getUser();

	// null = not signed in (show signup CTA)
	// "free" = signed in, no subscription row yet or free plan
	let currentPlan: SubscriptionPlan | null = null;
	if (user) {
		currentPlan = await getCurrentPlan(user.id).catch(() => null) ?? "free";
	}

	const monthlyPriceId = process.env.NEXT_PUBLIC_STRIPE_PRICE_MONTHLY ?? "";
	const annualPriceId = process.env.NEXT_PUBLIC_STRIPE_PRICE_ANNUAL ?? "";

	return (
		<div className="min-h-screen bg-surface-container-lowest px-4 py-16">
			<div className="max-w-2xl mx-auto">
				{/* Header */}
				<div className="text-center mb-12">
					<div className="text-xs font-mono text-muted-foreground uppercase tracking-widest mb-3">
						Pricing
					</div>
					<h1 className="text-foreground font-heading text-3xl font-bold mb-3">
						Choose your dig level
					</h1>
					<p className="text-muted-foreground font-mono text-sm max-w-sm mx-auto leading-relaxed">
						Free forever for casual diggers. Go Premium for unlimited trades and deeper tools.
					</p>
				</div>

				<PricingCards
					currentPlan={currentPlan}
					monthlyPriceId={monthlyPriceId}
					annualPriceId={annualPriceId}
				/>

				{/* Footer note */}
				<p className="text-center text-outline-variant font-mono text-xs mt-10">
					Cancel anytime. No hidden fees. Prices in USD.
				</p>
			</div>
		</div>
	);
}
