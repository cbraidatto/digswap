import Stripe from "stripe";
import { env, publicEnv } from "@/lib/env";

export type SubscriptionPlan = "free" | "premium_monthly" | "premium_annual";

let stripeClient: Stripe | null = null;

export function getStripe() {
	if (stripeClient) {
		return stripeClient;
	}

	const key = env.STRIPE_SECRET_KEY;
	if (!key) {
		throw new Error("STRIPE_SECRET_KEY is not configured.");
	}

	stripeClient = new Stripe(key, {
		// Pinned per Phase 16 plan; cast is required because stripe-node types only track the latest version.
		apiVersion: "2024-06-20" as Stripe.LatestApiVersion,
		typescript: true,
	});

	return stripeClient;
}

export function getSiteUrl() {
	const siteUrl = publicEnv.NEXT_PUBLIC_SITE_URL?.trim();
	if (siteUrl) {
		return siteUrl.replace(/\/$/, "");
	}

	// VERCEL_URL is auto-provided by Vercel, not in our Zod schema
	const vercelUrl = process.env.VERCEL_URL?.trim();
	if (vercelUrl) {
		return `https://${vercelUrl.replace(/\/$/, "")}`;
	}

	return "http://localhost:3000";
}

// NOTE: Price IDs are in NEXT_PUBLIC_ vars so the pricing page can read them
// client-side. This is an accepted risk — price IDs are semi-public and the
// backend validates them before creating checkout sessions. They do not grant
// payment access. See security audit LOW finding L-03.
export function getStripePriceIds() {
	const premiumAnnual = publicEnv.NEXT_PUBLIC_STRIPE_PRICE_ANNUAL;
	const premiumMonthly = publicEnv.NEXT_PUBLIC_STRIPE_PRICE_MONTHLY;
	if (!premiumAnnual || !premiumMonthly) {
		throw new Error(
			"Stripe price IDs (NEXT_PUBLIC_STRIPE_PRICE_ANNUAL/MONTHLY) are not configured.",
		);
	}
	return { premiumAnnual, premiumMonthly };
}

export function getPlanFromPriceId(priceId: string | null | undefined): SubscriptionPlan | null {
	if (!priceId) {
		return null;
	}

	const { premiumAnnual, premiumMonthly } = getStripePriceIds();
	if (priceId === premiumMonthly) {
		return "premium_monthly";
	}

	if (priceId === premiumAnnual) {
		return "premium_annual";
	}

	return null;
}

export function getPlanFromStripeSubscription(subscription: Stripe.Subscription): SubscriptionPlan {
	const firstItem = subscription.items.data[0];
	const planFromPriceId = getPlanFromPriceId(firstItem?.price.id);
	if (planFromPriceId) {
		return planFromPriceId;
	}

	return firstItem?.price.recurring?.interval === "year" ? "premium_annual" : "premium_monthly";
}

export function toIsoFromUnixTimestamp(value: number | null | undefined) {
	return typeof value === "number" ? new Date(value * 1000).toISOString() : null;
}

/**
 * Subscription statuses that entitle the user to premium access.
 * "trialing" and "active" are the only valid active states.
 * "past_due" keeps access during the retry grace period — Stripe will
 * send a `customer.subscription.deleted` event if payment ultimately fails.
 */
export const PREMIUM_ACTIVE_STATUSES = new Set(["active", "trialing", "past_due"]);

/**
 * Returns the tier a user should be on given their subscription plan and
 * Stripe subscription status.  Always pass both — never call with status
 * omitted, as the fallback would grant premium to cancelled users.
 */
export function getTierFromSubscription(
	plan: SubscriptionPlan,
	status: string,
): "free" | "premium" {
	const isPremiumPlan = plan === "premium_monthly" || plan === "premium_annual";
	if (!isPremiumPlan) return "free";
	return PREMIUM_ACTIVE_STATUSES.has(status) ? "premium" : "free";
}
