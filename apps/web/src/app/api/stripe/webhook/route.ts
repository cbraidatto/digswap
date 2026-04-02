import { NextResponse } from "next/server";
import type Stripe from "stripe";
import { getPlanFromStripeSubscription, getStripe, toIsoFromUnixTimestamp } from "@/lib/stripe";
import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";

function getWebhookSecret() {
	const secret = process.env.STRIPE_WEBHOOK_SECRET;
	if (!secret) {
		throw new Error("STRIPE_WEBHOOK_SECRET is not configured.");
	}

	return secret;
}

async function updateProfileTier(
	admin: ReturnType<typeof createAdminClient>,
	userId: string,
	tier: "free" | "premium",
) {
	const { error } = await admin
		.from("profiles")
		.update({
			subscription_tier: tier,
			updated_at: new Date().toISOString(),
		})
		.eq("id", userId);

	if (error) {
		throw error;
	}
}

async function upsertSubscriptionRecord(
	admin: ReturnType<typeof createAdminClient>,
	input: {
		currentPeriodEnd: string | null;
		currentPeriodStart: string | null;
		plan: "free" | "premium_monthly" | "premium_annual";
		status: string;
		stripeCustomerId: string | null;
		stripeSubscriptionId: string | null;
		userId: string;
	},
) {
	const { error } = await admin.from("subscriptions").upsert(
		{
			current_period_end: input.currentPeriodEnd,
			current_period_start: input.currentPeriodStart,
			plan: input.plan,
			status: input.status,
			stripe_customer_id: input.stripeCustomerId,
			stripe_subscription_id: input.stripeSubscriptionId,
			updated_at: new Date().toISOString(),
			user_id: input.userId,
		},
		{
			onConflict: "user_id",
		},
	);

	if (error) {
		throw error;
	}
}

async function findUserIdByCustomerId(
	admin: ReturnType<typeof createAdminClient>,
	customerId: string | null,
) {
	if (!customerId) {
		return null;
	}

	const { data, error } = await admin
		.from("subscriptions")
		.select("user_id")
		.eq("stripe_customer_id", customerId)
		.maybeSingle();

	if (error) {
		throw error;
	}

	return data?.user_id ?? null;
}

async function findUserIdForCheckoutSession(
	admin: ReturnType<typeof createAdminClient>,
	session: Stripe.Checkout.Session,
) {
	const metadataUserId = session.metadata?.userId ?? session.client_reference_id;
	if (metadataUserId) {
		return metadataUserId;
	}

	return findUserIdByCustomerId(
		admin,
		typeof session.customer === "string" ? session.customer : (session.customer?.id ?? null),
	);
}

function getSubscriptionPeriodBounds(subscription: Stripe.Subscription) {
	const firstItem = subscription.items.data[0];

	return {
		currentPeriodEnd: toIsoFromUnixTimestamp(firstItem?.current_period_end),
		currentPeriodStart: toIsoFromUnixTimestamp(firstItem?.current_period_start),
	};
}

async function handleCheckoutSessionCompleted(
	admin: ReturnType<typeof createAdminClient>,
	event: Stripe.CheckoutSessionCompletedEvent,
) {
	const session = event.data.object;
	const stripe = getStripe();
	const userId = await findUserIdForCheckoutSession(admin, session);

	if (!userId) {
		throw new Error("Stripe checkout session is missing a DigSwap user.");
	}

	const subscriptionId =
		typeof session.subscription === "string" ? session.subscription : session.subscription?.id;

	if (!subscriptionId) {
		throw new Error("Stripe checkout session is missing a subscription.");
	}

	const subscription = await stripe.subscriptions.retrieve(subscriptionId, {
		expand: ["items.data.price"],
	});
	const period = getSubscriptionPeriodBounds(subscription);

	await upsertSubscriptionRecord(admin, {
		currentPeriodEnd: period.currentPeriodEnd,
		currentPeriodStart: period.currentPeriodStart,
		plan: getPlanFromStripeSubscription(subscription),
		status: subscription.status,
		stripeCustomerId:
			typeof subscription.customer === "string" ? subscription.customer : subscription.customer.id,
		stripeSubscriptionId: subscription.id,
		userId,
	});

	await updateProfileTier(admin, userId, "premium");
}

async function handleCustomerSubscriptionUpdated(
	admin: ReturnType<typeof createAdminClient>,
	event: Stripe.CustomerSubscriptionUpdatedEvent,
) {
	const subscription = event.data.object;
	const period = getSubscriptionPeriodBounds(subscription);
	const userId = await findUserIdByCustomerId(
		admin,
		typeof subscription.customer === "string" ? subscription.customer : subscription.customer.id,
	);

	if (!userId) {
		throw new Error("Stripe subscription update could not be matched to a DigSwap user.");
	}

	await upsertSubscriptionRecord(admin, {
		currentPeriodEnd: period.currentPeriodEnd,
		currentPeriodStart: period.currentPeriodStart,
		plan: getPlanFromStripeSubscription(subscription),
		status: subscription.status,
		stripeCustomerId:
			typeof subscription.customer === "string" ? subscription.customer : subscription.customer.id,
		stripeSubscriptionId: subscription.id,
		userId,
	});

	await updateProfileTier(admin, userId, "premium");
}

async function handleCustomerSubscriptionDeleted(
	admin: ReturnType<typeof createAdminClient>,
	event: Stripe.CustomerSubscriptionDeletedEvent,
) {
	const subscription = event.data.object;
	const customerId =
		typeof subscription.customer === "string" ? subscription.customer : subscription.customer.id;
	const userId = await findUserIdByCustomerId(admin, customerId);

	if (!userId) {
		return;
	}

	await upsertSubscriptionRecord(admin, {
		currentPeriodEnd: null,
		currentPeriodStart: null,
		plan: "free",
		status: "cancelled",
		stripeCustomerId: customerId,
		stripeSubscriptionId: null,
		userId,
	});

	await updateProfileTier(admin, userId, "free");
}

async function handleInvoicePaymentFailed(
	admin: ReturnType<typeof createAdminClient>,
	event: Stripe.InvoicePaymentFailedEvent,
) {
	const invoice = event.data.object;
	const stripeSubscriptionId =
		typeof invoice.parent?.subscription_details?.subscription === "string"
			? invoice.parent.subscription_details.subscription
			: (invoice.parent?.subscription_details?.subscription?.id ?? null);

	const query = admin.from("subscriptions").update({
		status: "past_due",
		updated_at: new Date().toISOString(),
	});

	if (stripeSubscriptionId) {
		const { error } = await query.eq("stripe_subscription_id", stripeSubscriptionId);
		if (error) {
			throw error;
		}
		return;
	}

	const customerId =
		typeof invoice.customer === "string" ? invoice.customer : (invoice.customer?.id ?? null);
	if (!customerId) {
		return;
	}

	const { error } = await query.eq("stripe_customer_id", customerId);
	if (error) {
		throw error;
	}
}

export async function POST(request: Request) {
	let event: Stripe.Event;

	try {
		const signature = request.headers.get("stripe-signature");
		if (!signature) {
			return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
		}

		const stripe = getStripe();
		const rawBody = await request.text();
		event = stripe.webhooks.constructEvent(rawBody, signature, getWebhookSecret());
	} catch (error) {
		console.error("[stripe.webhook] signature verification failed", error);
		return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
	}

	const admin = createAdminClient();

	try {
		switch (event.type) {
			case "checkout.session.completed":
				await handleCheckoutSessionCompleted(admin, event);
				break;
			case "customer.subscription.updated":
				await handleCustomerSubscriptionUpdated(admin, event);
				break;
			case "customer.subscription.deleted":
				await handleCustomerSubscriptionDeleted(admin, event);
				break;
			case "invoice.payment_failed":
				await handleInvoicePaymentFailed(admin, event);
				break;
			default:
				break;
		}

		return NextResponse.json({ received: true });
	} catch (error) {
		console.error("[stripe.webhook] handler failed", error);
		return NextResponse.json({ error: "Webhook handler failed" }, { status: 500 });
	}
}
