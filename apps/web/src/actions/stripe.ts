"use server";

import { eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/lib/db";
import { subscriptions } from "@/lib/db/schema/subscriptions";
import { getSiteUrl, getStripe, getStripePriceIds } from "@/lib/stripe";
import { createClient } from "@/lib/supabase/server";

const checkoutPriceSchema = z.string().min(1, "Invalid price.");

async function requireUser() {
	const supabase = await createClient();
	const {
		data: { user },
	} = await supabase.auth.getUser();

	if (!user) {
		throw new Error("Not authenticated");
	}

	return user;
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

export async function createCheckoutSession(priceId: string): Promise<{ url: string }> {
	const user = await requireUser();
	const parsedPriceId = checkoutPriceSchema.safeParse(priceId);
	if (!parsedPriceId.success) {
		throw new Error(parsedPriceId.error.issues[0]?.message ?? "Invalid price.");
	}

	const { premiumAnnual, premiumMonthly } = getStripePriceIds();
	if (![premiumMonthly, premiumAnnual].includes(parsedPriceId.data)) {
		throw new Error("Unsupported billing plan.");
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
		throw new Error("Stripe checkout did not return a redirect URL.");
	}

	return { url: session.url };
}

export async function createPortalSession(): Promise<{ url: string }> {
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
		throw new Error("No billing account found for this user.");
	}

	const stripe = getStripe();
	const siteUrl = getSiteUrl();
	const session = await stripe.billingPortal.sessions.create({
		customer: stripeCustomerId,
		return_url: `${siteUrl}/settings/billing`,
	});

	return { url: session.url };
}
