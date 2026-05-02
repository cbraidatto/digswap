"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import type { SubscriptionPlan } from "@/lib/stripe";

const MONTHLY_PRICE = "$9.90";
const ANNUAL_PRICE = "$99";
const ANNUAL_MONTHLY_EQUIV = "$8.25";

const FREE_FEATURES = [
	"5 trades per month",
	"Full Discogs collection import",
	"Wantlist matching",
	"Community access",
	"Global leaderboard",
];

const PREMIUM_FEATURES = [
	"Unlimited trades",
	"Collection analytics",
	"Premium groups",
	"Priority matching",
	"Supporter badge on profile",
	"Everything in Free",
];

interface Props {
	currentPlan: SubscriptionPlan | null;
	monthlyPriceId: string;
	annualPriceId: string;
}

export function PricingCards({ currentPlan, monthlyPriceId, annualPriceId }: Props) {
	const [billing, setBilling] = useState<"monthly" | "annual">("monthly");
	const [isPending, startTransition] = useTransition();
	const router = useRouter();

	const isPremium = currentPlan === "premium_monthly" || currentPlan === "premium_annual";

	async function handleUpgrade() {
		startTransition(async () => {
			const priceId = billing === "monthly" ? monthlyPriceId : annualPriceId;
			const { createCheckoutSession } = await import("@/actions/stripe");
			const result = await createCheckoutSession(priceId);
			if ("error" in result) {
				// Phase 37 D-14 feature flag is in deferred state OR Stripe is genuinely
				// unreachable. Either way, show the error so the click isn't silent.
				toast.error(result.error);
				return;
			}
			router.push(result.url);
		});
	}

	async function handleManage() {
		startTransition(async () => {
			const { createPortalSession } = await import("@/actions/stripe");
			const result = await createPortalSession();
			if ("error" in result) {
				toast.error(result.error);
				return;
			}
			router.push(result.url);
		});
	}

	return (
		<div className="flex flex-col items-center gap-8">
			{/* Billing toggle */}
			<div className="flex items-center gap-1 bg-surface-container border border-outline-variant rounded p-0.5">
				<button
					type="button"
					onClick={() => setBilling("monthly")}
					className={`px-4 py-1.5 text-xs font-mono rounded transition-all ${
						billing === "monthly"
							? "bg-surface-dim text-foreground border border-primary/30"
							: "text-muted-foreground hover:text-muted-foreground"
					}`}
				>
					MONTHLY
				</button>
				<button
					type="button"
					onClick={() => setBilling("annual")}
					className={`px-4 py-1.5 text-xs font-mono rounded transition-all ${
						billing === "annual"
							? "bg-surface-dim text-foreground border border-primary/30"
							: "text-muted-foreground hover:text-muted-foreground"
					}`}
				>
					ANNUAL
					<span className="ml-1.5 text-[9px] text-tertiary pointer-events-none">SAVE 17%</span>
				</button>
			</div>

			{/* Plan cards */}
			<div className="grid grid-cols-1 md:grid-cols-2 gap-4 w-full max-w-2xl">
				{/* Free card */}
				<div className="bg-surface-container border border-outline-variant rounded p-6 flex flex-col gap-5">
					<div>
						<div className="text-xs font-mono text-muted-foreground uppercase tracking-widest mb-1">
							Free
						</div>
						<div className="text-foreground font-mono text-2xl font-bold">
							$0
							<span className="text-xs text-muted-foreground font-normal ml-1">/month</span>
						</div>
					</div>

					<ul className="flex flex-col gap-2 flex-1">
						{FREE_FEATURES.map((f) => (
							<li key={f} className="flex items-center gap-2">
								<span className="text-muted-foreground text-xs">✓</span>
								<span className="text-muted-foreground text-xs font-mono">{f}</span>
							</li>
						))}
					</ul>

					<div>
						{currentPlan === null ? (
							<a
								href="/signup"
								className="w-full block text-center bg-surface-container-low border border-outline-variant text-muted-foreground font-mono text-xs py-2.5 rounded hover:border-outline transition-colors"
							>
								Get started free
							</a>
						) : (
							<div className="w-full text-center bg-surface-container border border-outline-variant text-muted-foreground font-mono text-xs py-2.5 rounded cursor-default">
								{isPremium ? "INCLUDED" : "CURRENT_PLAN"}
							</div>
						)}
					</div>
				</div>

				{/* Premium card */}
				<div className="bg-surface-dim border border-primary/40 rounded p-6 flex flex-col gap-5 relative shadow-[0_0_30px_rgba(200,145,74,0.06)]">
					{/* "Most popular" chip */}
					<div className="absolute -top-3 left-1/2 -translate-x-1/2">
						<span className="bg-primary text-background font-mono text-[9px] uppercase tracking-widest px-3 py-0.5 rounded-full font-bold">
							MOST POPULAR
						</span>
					</div>

					<div>
						<div className="text-xs font-mono text-primary uppercase tracking-widest mb-1">
							Premium
						</div>
						<div className="text-foreground font-mono text-2xl font-bold">
							{billing === "monthly" ? MONTHLY_PRICE : ANNUAL_MONTHLY_EQUIV}
							<span className="text-xs text-muted-foreground font-normal ml-1">/month</span>
						</div>
						{billing === "annual" && (
							<div className="text-xs font-mono text-tertiary mt-0.5">
								{ANNUAL_PRICE}/year — billed annually
							</div>
						)}
					</div>

					<ul className="flex flex-col gap-2 flex-1">
						{PREMIUM_FEATURES.map((f) => (
							<li key={f} className="flex items-center gap-2">
								<span className="text-primary text-xs">✓</span>
								<span className="text-on-surface-variant text-xs font-mono">{f}</span>
							</li>
						))}
					</ul>

					<div>
						{isPremium ? (
							<button
								type="button"
								onClick={handleManage}
								disabled={isPending}
								className="w-full bg-surface-container-low border border-outline-variant text-muted-foreground font-mono text-xs py-2.5 rounded hover:border-outline transition-colors disabled:opacity-50"
							>
								{isPending ? "..." : "MANAGE_SUBSCRIPTION"}
							</button>
						) : currentPlan === null ? (
							<a
								href="/signup"
								className="w-full block text-center bg-primary text-background font-mono text-xs font-bold py-2.5 rounded hover:brightness-110 transition-all"
							>
								Upgrade to Premium
							</a>
						) : (
							<button
								type="button"
								onClick={handleUpgrade}
								disabled={isPending}
								className="w-full bg-primary text-background font-mono text-xs font-bold py-2.5 rounded hover:brightness-110 transition-all disabled:opacity-50"
							>
								{isPending ? "..." : "Upgrade to Premium"}
							</button>
						)}
					</div>
				</div>
			</div>
		</div>
	);
}
