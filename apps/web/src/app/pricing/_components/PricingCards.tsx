"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
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

	const isPremium =
		currentPlan === "premium_monthly" || currentPlan === "premium_annual";

	async function handleUpgrade() {
		startTransition(async () => {
			const priceId = billing === "monthly" ? monthlyPriceId : annualPriceId;
			const { createCheckoutSession } = await import("@/actions/stripe");
			const { url } = await createCheckoutSession(priceId);
			router.push(url);
		});
	}

	async function handleManage() {
		startTransition(async () => {
			const { createPortalSession } = await import("@/actions/stripe");
			const { url } = await createPortalSession();
			router.push(url);
		});
	}

	return (
		<div className="flex flex-col items-center gap-8">
			{/* Billing toggle */}
			<div className="flex items-center gap-1 bg-[#111008] border border-[#2a2218] rounded p-0.5">
				<button
					onClick={() => setBilling("monthly")}
					className={`px-4 py-1.5 text-xs font-mono rounded transition-all ${
						billing === "monthly"
							? "bg-[#1a1208] text-[#e8dcc8] border border-[#c8914a]/30"
							: "text-[#4a4035] hover:text-[#7a6e5f]"
					}`}
				>
					MONTHLY
				</button>
				<button
					onClick={() => setBilling("annual")}
					className={`px-4 py-1.5 text-xs font-mono rounded transition-all ${
						billing === "annual"
							? "bg-[#1a1208] text-[#e8dcc8] border border-[#c8914a]/30"
							: "text-[#4a4035] hover:text-[#7a6e5f]"
					}`}
				>
					ANNUAL
					<span className="ml-1.5 text-[9px] text-[#7ac87a]">SAVE 17%</span>
				</button>
			</div>

			{/* Plan cards */}
			<div className="grid grid-cols-1 md:grid-cols-2 gap-4 w-full max-w-2xl">
				{/* Free card */}
				<div className="bg-[#111008] border border-[#2a2218] rounded p-6 flex flex-col gap-5">
					<div>
						<div className="text-[10px] font-mono text-[#4a4035] uppercase tracking-widest mb-1">
							Free
						</div>
						<div className="text-[#e8dcc8] font-mono text-2xl font-bold">
							$0
							<span className="text-xs text-[#4a4035] font-normal ml-1">/month</span>
						</div>
					</div>

					<ul className="flex flex-col gap-2 flex-1">
						{FREE_FEATURES.map((f) => (
							<li key={f} className="flex items-center gap-2">
								<span className="text-[#4a4035] text-xs">✓</span>
								<span className="text-[#7a6e5f] text-xs font-mono">{f}</span>
							</li>
						))}
					</ul>

					<div>
						{currentPlan === null ? (
							<a
								href="/signup"
								className="w-full block text-center bg-[#1a1610] border border-[#2a2218] text-[#7a6e5f] font-mono text-xs py-2.5 rounded hover:border-[#3a3228] transition-colors"
							>
								GET_STARTED_FREE
							</a>
						) : (
							<div className="w-full text-center bg-[#111008] border border-[#2a2218] text-[#4a4035] font-mono text-xs py-2.5 rounded cursor-default">
								{isPremium ? "INCLUDED" : "CURRENT_PLAN"}
							</div>
						)}
					</div>
				</div>

				{/* Premium card */}
				<div className="bg-[#1a1208] border border-[#c8914a]/40 rounded p-6 flex flex-col gap-5 relative shadow-[0_0_30px_rgba(200,145,74,0.06)]">
					{/* "Most popular" chip */}
					<div className="absolute -top-3 left-1/2 -translate-x-1/2">
						<span className="bg-[#c8914a] text-[#0d0d0d] font-mono text-[9px] uppercase tracking-widest px-3 py-0.5 rounded-full font-bold">
							MOST POPULAR
						</span>
					</div>

					<div>
						<div className="text-[10px] font-mono text-[#c8914a] uppercase tracking-widest mb-1">
							Premium
						</div>
						<div className="text-[#e8dcc8] font-mono text-2xl font-bold">
							{billing === "monthly" ? MONTHLY_PRICE : ANNUAL_MONTHLY_EQUIV}
							<span className="text-xs text-[#4a4035] font-normal ml-1">/month</span>
						</div>
						{billing === "annual" && (
							<div className="text-[10px] font-mono text-[#7ac87a] mt-0.5">
								{ANNUAL_PRICE}/year — billed annually
							</div>
						)}
					</div>

					<ul className="flex flex-col gap-2 flex-1">
						{PREMIUM_FEATURES.map((f) => (
							<li key={f} className="flex items-center gap-2">
								<span className="text-[#c8914a] text-xs">✓</span>
								<span className="text-[#c8b898] text-xs font-mono">{f}</span>
							</li>
						))}
					</ul>

					<div>
						{isPremium ? (
							<button
								onClick={handleManage}
								disabled={isPending}
								className="w-full bg-[#1a1610] border border-[#2a2218] text-[#7a6e5f] font-mono text-xs py-2.5 rounded hover:border-[#3a3228] transition-colors disabled:opacity-50"
							>
								{isPending ? "..." : "MANAGE_SUBSCRIPTION"}
							</button>
						) : currentPlan === null ? (
							<a
								href="/signup"
								className="w-full block text-center bg-[#c8914a] text-[#0d0d0d] font-mono text-xs font-bold py-2.5 rounded hover:brightness-110 transition-all"
							>
								UPGRADE_TO_PREMIUM
							</a>
						) : (
							<button
								onClick={handleUpgrade}
								disabled={isPending}
								className="w-full bg-[#c8914a] text-[#0d0d0d] font-mono text-xs font-bold py-2.5 rounded hover:brightness-110 transition-all disabled:opacity-50"
							>
								{isPending ? "..." : "UPGRADE_TO_PREMIUM"}
							</button>
						)}
					</div>
				</div>
			</div>
		</div>
	);
}
