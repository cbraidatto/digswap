"use server";

import { eq } from "drizzle-orm";
import { z } from "zod";
import { requireUser } from "@/lib/auth/require-user";
import { db } from "@/lib/db";
import { subscriptions } from "@/lib/db/schema/subscriptions";
import { publicEnv } from "@/lib/env";
import { getSiteUrl, getStripe, getStripePriceIds } from "@/lib/stripe";

const checkoutPriceSchema = z.string().min(1, "Invalid price.");

/**
 * Phase 37 D-14 feature flag — when false, Stripe-dependent actions
 * short-circuit with a friendly error rather than calling Stripe SDK with
 * the DEFERRED placeholder credentials (which would 401 on first request).
 *
 * Flips to "true" in Wave 4 atomic swap after Stripe Live activation.
 */
function billingEnabled(): boolean {
	return publicEnv.NEXT_PUBLIC_BILLING_ENABLED === "true";
}

async function ensureSubscriptionRecord(userId: string) {
	const rows = await db
		.select({
			id: subscriptions.id,
			plan: subscriptions.plan,
			status: subscriptions.status,
			stripeCustomerId: subscriptions.stripeCustomerId,
		})
		.from(subscriptions)
		.where(eq(subscriptions.userId, userId))
		.limit(1);

	const existing = rows[0];
	if (existing) {
		return existing;
	}

	await db.insert(subscriptions).values({
		plan: "free",
		status: "active",
		tradesThisMonth: 0,
		tradesMonthReset: new Date(),
		userId,
	});

	return {
		id: null,
		plan: "free",
		status: "active",
		stripeCustomerId: null,
	};
}

async function ensureStripeCustomer(userId: string, email: string | undefined) {
	const existing = await ensureSubscriptionRecord(userId);
	if (existing.stripeCustomerId) {
		return existing.stripeCustomerId;
	}

	const stripe = getStripe();
	const customer = await stripe.customers.create({
		email,
		metadata: {
			userId,
		},
	});

	await db
		.update(subscriptions)
		.set({
			stripeCustomerId: customer.id,
			updatedAt: new Date(),
		})
		.where(eq(subscriptions.userId, userId));

	return customer.id;
}

export async function createCheckoutSession(
	priceId: string,
): Promise<{ url: string } | { error: string }> {
	if (!billingEnabled()) {
		return { error: "Billing is currently unavailable. Please check back soon." };
	}
	try {
		const user = await requireUser();
		const parsedPriceId = checkoutPriceSchema.safeParse(priceId);
		if (!parsedPriceId.success) {
			return { error: parsedPriceId.error.issues[0]?.message ?? "Invalid price." };
		}

		const { premiumAnnual, premiumMonthly } = getStripePriceIds();
		if (![premiumMonthly, premiumAnnual].includes(parsedPriceId.data)) {
			return { error: "Unsupported billing plan." };
		}

		const customerId = await ensureStripeCustomer(user.id, user.email);
		const stripe = getStripe();
		const siteUrl = getSiteUrl();

		const session = await stripe.checkout.sessions.create({
			cancel_url: `${siteUrl}/pricing`,
			client_reference_id: user.id,
			customer: customerId,
			line_items: [{ price: parsedPriceId.data, quantity: 1 }],
			metadata: {
				userId: user.id,
			},
			mode: "subscription",
			success_url: `${siteUrl}/settings/billing?success=true`,
		});

		if (!session.url) {
			return { error: "Stripe checkout did not return a redirect URL." };
		}

		return { url: session.url };
	} catch (err) {
		console.error("[createCheckoutSession] error:", err);
		return { error: "Failed to create checkout session. Please try again." };
	}
}

export async function createPortalSession(): Promise<{ url: string } | { error: string }> {
	if (!billingEnabled()) {
		return { error: "Billing is currently unavailable. Please check back soon." };
	}
	try {
		const user = await requireUser();
		const rows = await db
			.select({
				stripeCustomerId: subscriptions.stripeCustomerId,
			})
			.from(subscriptions)
			.where(eq(subscriptions.userId, user.id))
			.limit(1);

		const stripeCustomerId = rows[0]?.stripeCustomerId;
		if (!stripeCustomerId) {
			return { error: "No billing account found for this user." };
		}

		const stripe = getStripe();
		const siteUrl = getSiteUrl();
		const session = await stripe.billingPortal.sessions.create({
			customer: stripeCustomerId,
			return_url: `${siteUrl}/settings/billing`,
		});

		return { url: session.url };
	} catch (err) {
		console.error("[createPortalSession] error:", err);
		return { error: "Failed to create billing portal session. Please try again." };
	}
}
