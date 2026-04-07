import Link from "next/link";
import { redirect } from "next/navigation";
import { getQuotaStatus } from "@/lib/entitlements";
import { createClient } from "@/lib/supabase/server";
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
				<h1 className="font-heading text-xl font-semibold text-foreground">Billing</h1>
				<span
					className={`text-xs uppercase tracking-widest px-2 py-0.5 rounded border ${
						isPremium
							? "bg-primary/10 border-primary/30 text-primary"
							: "bg-surface-container border-outline-variant text-muted-foreground"
					}`}
				>
					{planLabel}
				</span>
			</div>

			{/* Success banner */}
			{showSuccess && (
				<div className="bg-tertiary/5 border border-tertiary/20 rounded p-4 flex items-start gap-3">
					<span className="material-symbols-outlined text-tertiary text-sm flex-shrink-0 mt-0.5">
						check_circle
					</span>
					<div>
						<div className="text-tertiary text-xs font-bold">Subscription activated</div>
						<div className="text-tertiary/60 text-xs mt-0.5">
							Welcome to Premium — unlimited trades unlocked.
						</div>
					</div>
				</div>
			)}

			{/* Subscription card */}
			<div className="bg-surface-container border border-outline-variant rounded p-5 space-y-4">
				<div className="text-xs text-muted-foreground uppercase tracking-widest">Current plan</div>

				{isPremium ? (
					<div className="space-y-3">
						<div className="flex items-center justify-between">
							<span className="text-foreground text-sm">Premium</span>
							<span className="text-primary text-xs">Active</span>
						</div>
						<div className="flex items-center justify-between text-xs">
							<span className="text-muted-foreground">Next renewal</span>
							<span className="text-on-surface-variant">{formatDate(currentPeriodEnd)}</span>
						</div>
						<div className="flex items-center justify-between text-xs">
							<span className="text-muted-foreground">Trades this month</span>
							<span className="text-on-surface-variant">Unlimited</span>
						</div>
					</div>
				) : (
					<div className="space-y-4">
						<div className="flex items-center justify-between">
							<span className="text-foreground text-sm">Free</span>
							<span className="text-muted-foreground text-xs">Active</span>
						</div>

						{/* Quota bar */}
						<div className="space-y-1.5">
							<div className="flex items-center justify-between text-xs">
								<span className="text-muted-foreground">Trades this month</span>
								<span className="text-on-surface-variant">
									{quota.tradesUsed} / {quota.tradesLimit}
								</span>
							</div>
							<div className="h-1.5 bg-surface-container-low rounded-full overflow-hidden">
								<div
									className="h-full bg-primary rounded-full transition-all"
									style={{ width: `${Math.min(quota.percentUsed ?? 0, 100)}%` }}
								/>
							</div>
							{quota.tradesUsed >= (quota.tradesLimit ?? 5) && (
								<p className="text-xs text-primary">
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
							className="block w-full text-center bg-primary text-primary-foreground text-xs font-bold py-3 rounded hover:brightness-110 transition-all"
						>
							Upgrade to Premium
						</Link>
						<p className="text-center text-xs text-muted-foreground/50">
							Unlimited trades from $8.25/month
						</p>
					</div>
				)}
			</div>

			<div className="border-t border-outline-variant pt-4">
				<Link
					href="/settings"
					className="text-muted-foreground hover:text-on-surface-variant text-xs transition-colors"
				>
					← Back to Settings
				</Link>
			</div>
		</div>
	);
}
