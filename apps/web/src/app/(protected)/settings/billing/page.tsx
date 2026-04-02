import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { getQuotaStatus } from "@/lib/entitlements";
import { ManageButton } from "./_components/ManageButton";

export const metadata = {
	title: "Billing — DigSwap",
};

function formatDate(date: Date | null | undefined): string {
	if (!date) return "—";
	return new Date(date).toLocaleDateString("en-GB", {
		day: "2-digit",
		month: "short",
		year: "numeric",
	});
}

interface SearchParams {
	success?: string;
}

export default async function BillingPage({
	searchParams,
}: {
	searchParams: Promise<SearchParams>;
}) {
	const supabase = await createClient();
	const {
		data: { user },
	} = await supabase.auth.getUser();
	if (!user) redirect("/signin");

	const [quota, subData, params] = await Promise.all([
		getQuotaStatus(user.id),
		supabase
			.from("subscriptions")
			.select("current_period_end")
			.eq("user_id", user.id)
			.maybeSingle()
			.then((r) => r.data),
		searchParams,
	]);

	const showSuccess = params.success === "true";
	const isPremium = quota.isPremium;
	const planLabel = isPremium ? "PREMIUM" : "FREE";
	const currentPeriodEnd = subData?.current_period_end
		? new Date(subData.current_period_end)
		: null;

	return (
		<div className="mx-auto w-full max-w-[640px] px-4 py-6 space-y-6">
			{/* Header */}
			<div className="flex items-center gap-3">
				<h1 className="font-heading text-xl font-semibold text-[#e8dcc8]">Billing</h1>
				<span
					className={`text-[10px] font-mono uppercase tracking-widest px-2 py-0.5 rounded border ${
						isPremium
							? "bg-[#c8914a]/10 border-[#c8914a]/30 text-[#c8914a]"
							: "bg-[#111008] border-[#2a2218] text-[#4a4035]"
					}`}
				>
					{planLabel}
				</span>
			</div>

			{/* Success banner */}
			{showSuccess && (
				<div className="bg-[#0a1a0a] border border-[#7ac87a]/20 rounded p-4 flex items-start gap-3">
					<span className="material-symbols-outlined text-[#7ac87a] text-sm flex-shrink-0 mt-0.5">
						check_circle
					</span>
					<div>
						<div className="text-[#7ac87a] font-mono text-xs font-bold">
							Subscription activated
						</div>
						<div className="text-[#4a7a4a] font-mono text-xs mt-0.5">
							Welcome to Premium — unlimited trades unlocked.
						</div>
					</div>
				</div>
			)}

			{/* Subscription card */}
			<div className="bg-[#111008] border border-[#2a2218] rounded p-5 space-y-4">
				<div className="text-[10px] font-mono text-[#4a4035] uppercase tracking-widest">
					Current plan
				</div>

				{isPremium ? (
					<div className="space-y-3">
						<div className="flex items-center justify-between">
							<span className="text-[#e8dcc8] font-mono text-sm">Premium</span>
							<span className="text-[#c8914a] font-mono text-xs">Active</span>
						</div>
						<div className="flex items-center justify-between text-xs font-mono">
							<span className="text-[#4a4035]">Next renewal</span>
							<span className="text-[#7a6e5f]">
								{formatDate(currentPeriodEnd)}
							</span>
						</div>
						<div className="flex items-center justify-between text-xs font-mono">
							<span className="text-[#4a4035]">Trades this month</span>
							<span className="text-[#7a6e5f]">Unlimited</span>
						</div>
					</div>
				) : (
					<div className="space-y-4">
						<div className="flex items-center justify-between">
							<span className="text-[#e8dcc8] font-mono text-sm">Free</span>
							<span className="text-[#4a4035] font-mono text-xs">Active</span>
						</div>

						{/* Quota bar */}
						<div className="space-y-1.5">
							<div className="flex items-center justify-between text-xs font-mono">
								<span className="text-[#4a4035]">Trades this month</span>
								<span className="text-[#7a6e5f]">
									{quota.tradesUsed} / {quota.tradesLimit}
								</span>
							</div>
							<div className="h-1.5 bg-[#1a1610] rounded-full overflow-hidden">
								<div
									className="h-full bg-[#c8914a] rounded-full transition-all"
									style={{ width: `${Math.min(quota.percentUsed ?? 0, 100)}%` }}
								/>
							</div>
							{quota.tradesUsed >= (quota.tradesLimit ?? 5) && (
								<p className="text-[10px] font-mono text-[#c8914a]">
									Monthly limit reached — resets on the 1st of next month
								</p>
							)}
						</div>
					</div>
				)}
			</div>

			{/* CTA */}
			<div>
				{isPremium ? (
					<ManageButton />
				) : (
					<div className="space-y-3">
						<Link
							href="/pricing"
							className="block w-full text-center bg-[#c8914a] text-[#0d0d0d] font-mono text-xs font-bold py-3 rounded hover:brightness-110 transition-all"
						>
							UPGRADE_TO_PREMIUM
						</Link>
						<p className="text-center text-[10px] font-mono text-[#2a2218]">
							Unlimited trades from $8.25/month
						</p>
					</div>
				)}
			</div>

			<div className="border-t border-[#1a1610] pt-4">
				<Link
					href="/settings"
					className="text-[#4a4035] hover:text-[#7a6e5f] font-mono text-xs transition-colors"
				>
					← Back to Settings
				</Link>
			</div>
		</div>
	);
}

