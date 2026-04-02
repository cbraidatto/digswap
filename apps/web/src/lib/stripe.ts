import Stripe from "stripe";

export type SubscriptionPlan = "free" | "premium_monthly" | "premium_annual";

let stripeClient: Stripe | null = null;

function requireEnv(name: string) {
	const value = process.env[name];
	if (!value) {
		throw new Error(`${name} is not configured.`);
	}

	return value;
}

export function getStripe() {
	if (stripeClient) {
		return stripeClient;
	}

	stripeClient = new Stripe(requireEnv("STRIPE_SECRET_KEY"), {
		// Pinned per Phase 16 plan; cast is required because stripe-node types only track the latest version.
		apiVersion: "2024-06-20" as Stripe.LatestApiVersion,
		typescript: true,
	});

	return stripeClient;
}

export function getSiteUrl() {
	const siteUrl = process.env.NEXT_PUBLIC_SITE_URL?.trim();
	if (siteUrl) {
		return siteUrl.replace(/\/$/, "");
	}

	const vercelUrl = process.env.VERCEL_URL?.trim();
	if (vercelUrl) {
		return `https://${vercelUrl.replace(/\/$/, "")}`;
	}

	return "http://localhost:3000";
}

export function getStripePriceIds() {
	return {
		premiumAnnual: requireEnv("NEXT_PUBLIC_STRIPE_PRICE_ANNUAL"),
		premiumMonthly: requireEnv("NEXT_PUBLIC_STRIPE_PRICE_MONTHLY"),
	};
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
