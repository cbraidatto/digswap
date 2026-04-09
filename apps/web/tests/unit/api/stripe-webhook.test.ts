import { beforeEach, describe, expect, it, vi } from "vitest";

// -- Mock env module (cached at import time, so process.env mutations don't work) --
vi.mock("@/lib/env", () => ({
	env: {
		DATABASE_URL: "postgresql://test:test@localhost:5432/test",
		SUPABASE_SERVICE_ROLE_KEY: "test-service-role-key",
		DISCOGS_CONSUMER_KEY: "test-discogs-key",
		DISCOGS_CONSUMER_SECRET: "test-discogs-secret",
		IMPORT_WORKER_SECRET: "test-import-worker-secret",
		HANDOFF_HMAC_SECRET: "dev-hmac-secret-not-for-production",
		UPSTASH_REDIS_REST_URL: "",
		UPSTASH_REDIS_REST_TOKEN: "",
		RESEND_API_KEY: "",
		RESEND_FROM_EMAIL: "noreply@digswap.com",
		STRIPE_WEBHOOK_SECRET: "whsec_test",
		YOUTUBE_API_KEY: "",
		SYSTEM_USER_ID: "",
		NODE_ENV: "test",
	},
	publicEnv: {
		NEXT_PUBLIC_SUPABASE_URL: "https://test.supabase.co",
		NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "test-anon-key",
		NEXT_PUBLIC_SITE_URL: "http://localhost:3000",
		NEXT_PUBLIC_APP_URL: "http://localhost:3000",
		NEXT_PUBLIC_STRIPE_PRICE_MONTHLY: "",
		NEXT_PUBLIC_STRIPE_PRICE_ANNUAL: "",
		NEXT_PUBLIC_MIN_DESKTOP_VERSION: "1",
	},
}));

const {
	mockConstructEvent,
	mockProfilesUpdate,
	mockProfilesUpdateEq,
	mockSubscriptionsMaybeSingle,
	mockSubscriptionsSelect,
	mockSubscriptionsSelectEq,
	mockSubscriptionsUpsert,
	mockSubscriptionsUpdate,
	mockSubscriptionsUpdateEq,
	mockSubscriptionRetrieve,
	mockToIsoFromUnixTimestamp,
	mockGetPlanFromStripeSubscription,
	mockGetTierFromSubscription,
} = vi.hoisted(() => ({
	mockConstructEvent: vi.fn(),
	mockGetPlanFromStripeSubscription: vi.fn(),
	mockGetTierFromSubscription: vi.fn(),
	mockProfilesUpdate: vi.fn(),
	mockProfilesUpdateEq: vi.fn(),
	mockSubscriptionsMaybeSingle: vi.fn(),
	mockSubscriptionsSelect: vi.fn(),
	mockSubscriptionsSelectEq: vi.fn(),
	mockSubscriptionsUpdate: vi.fn(),
	mockSubscriptionsUpdateEq: vi.fn(),
	mockSubscriptionsUpsert: vi.fn(),
	mockSubscriptionRetrieve: vi.fn(),
	mockToIsoFromUnixTimestamp: vi.fn(),
}));

vi.mock("@/lib/stripe", () => ({
	getPlanFromStripeSubscription: mockGetPlanFromStripeSubscription,
	getTierFromSubscription: mockGetTierFromSubscription,
	getStripe: vi.fn(() => ({
		subscriptions: {
			retrieve: mockSubscriptionRetrieve,
		},
		webhooks: {
			constructEvent: mockConstructEvent,
		},
	})),
	toIsoFromUnixTimestamp: mockToIsoFromUnixTimestamp,
}));

vi.mock("@/lib/supabase/admin", () => ({
	createAdminClient: vi.fn(() => ({
		from: vi.fn((table: string) => {
			if (table === "subscriptions") {
				return {
					select: mockSubscriptionsSelect.mockImplementation(() => ({
						eq: mockSubscriptionsSelectEq.mockImplementation(() => ({
							maybeSingle: mockSubscriptionsMaybeSingle,
						})),
					})),
					update: mockSubscriptionsUpdate.mockImplementation(() => ({
						eq: mockSubscriptionsUpdateEq,
					})),
					upsert: mockSubscriptionsUpsert,
				};
			}

			if (table === "profiles") {
				return {
					update: mockProfilesUpdate.mockImplementation(() => ({
						eq: mockProfilesUpdateEq,
					})),
				};
			}

			// stripe_event_log — idempotency table: select returns no existing event,
			// insert is a no-op (always succeeds for test purposes)
			if (table === "stripe_event_log") {
				return {
					select: vi.fn().mockReturnValue({
						eq: vi.fn().mockReturnValue({
							maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
						}),
					}),
					insert: vi.fn().mockResolvedValue({ error: null }),
				};
			}

			throw new Error(`Unexpected admin table: ${table}`);
		}),
	})),
}));

vi.mock("@/lib/rate-limit", () => ({
	apiRateLimit: null,
	safeLimit: vi.fn(async () => ({ success: true })),
}));

const { POST } = await import("@/app/api/stripe/webhook/route");

function createRequest(body = "{}") {
	return new Request("http://localhost:3000/api/stripe/webhook", {
		body,
		headers: {
			"content-type": "application/json",
			"stripe-signature": "test_signature",
		},
		method: "POST",
	});
}

beforeEach(() => {
	vi.clearAllMocks();

	mockGetPlanFromStripeSubscription.mockReturnValue("premium_monthly");
	mockGetTierFromSubscription.mockReturnValue("premium");
	mockToIsoFromUnixTimestamp.mockImplementation((value: number | null | undefined) =>
		typeof value === "number" ? new Date(value * 1000).toISOString() : null,
	);
	mockSubscriptionsUpsert.mockResolvedValue({ error: null });
	mockSubscriptionsMaybeSingle.mockResolvedValue({
		data: { user_id: "user-1" },
		error: null,
	});
	mockSubscriptionsUpdateEq.mockResolvedValue({ error: null });
	mockProfilesUpdateEq.mockResolvedValue({ error: null });
	mockSubscriptionRetrieve.mockResolvedValue({
		customer: "cus_123",
		id: "sub_123",
		items: {
			data: [
				{
					current_period_end: 1712592000,
					current_period_start: 1710000000,
					price: {
						id: "price_monthly",
						recurring: { interval: "month" },
					},
				},
			],
		},
		status: "active",
	});
});

describe("Stripe webhook route", () => {
	it("returns 400 for an invalid signature", async () => {
		mockConstructEvent.mockImplementation(() => {
			throw new Error("bad signature");
		});

		const response = await POST(createRequest());

		expect(response.status).toBe(400);
		await expect(response.json()).resolves.toEqual({ error: "Invalid signature" });
	});

	it("handles checkout.session.completed and syncs subscription state", async () => {
		mockConstructEvent.mockReturnValue({
			data: {
				object: {
					client_reference_id: "user-1",
					customer: "cus_123",
					metadata: { userId: "user-1" },
					subscription: "sub_123",
				},
			},
			type: "checkout.session.completed",
		});

		const response = await POST(createRequest(JSON.stringify({ id: "evt_checkout" })));

		expect(response.status).toBe(200);
		expect(mockSubscriptionRetrieve).toHaveBeenCalledWith("sub_123", {
			expand: ["items.data.price"],
		});
		expect(mockSubscriptionsUpsert).toHaveBeenCalledWith(
			expect.objectContaining({
				current_period_end: expect.any(String),
				current_period_start: expect.any(String),
				plan: "premium_monthly",
				status: "active",
				stripe_customer_id: "cus_123",
				stripe_subscription_id: "sub_123",
				user_id: "user-1",
			}),
			{ onConflict: "user_id" },
		);
		expect(mockProfilesUpdate).toHaveBeenCalledWith(
			expect.objectContaining({
				subscription_tier: "premium",
				updated_at: expect.any(String),
			}),
		);
		expect(mockProfilesUpdateEq).toHaveBeenCalledWith("id", "user-1");
		await expect(response.json()).resolves.toEqual({ received: true });
	});

	it("handles customer.subscription.deleted and reverts the plan to free", async () => {
		mockConstructEvent.mockReturnValue({
			data: {
				object: {
					customer: "cus_123",
				},
			},
			type: "customer.subscription.deleted",
		});

		const response = await POST(createRequest(JSON.stringify({ id: "evt_deleted" })));

		expect(response.status).toBe(200);
		expect(mockSubscriptionsSelect).toHaveBeenCalledWith("user_id");
		expect(mockSubscriptionsSelectEq).toHaveBeenCalledWith("stripe_customer_id", "cus_123");
		expect(mockSubscriptionsUpsert).toHaveBeenCalledWith(
			expect.objectContaining({
				current_period_end: null,
				current_period_start: null,
				plan: "free",
				status: "cancelled",
				stripe_customer_id: "cus_123",
				stripe_subscription_id: null,
				user_id: "user-1",
			}),
			{ onConflict: "user_id" },
		);
		expect(mockProfilesUpdate).toHaveBeenCalledWith(
			expect.objectContaining({
				subscription_tier: "free",
			}),
		);
		await expect(response.json()).resolves.toEqual({ received: true });
	});

	it("handles invoice.payment_failed and marks the subscription as past_due", async () => {
		mockConstructEvent.mockReturnValue({
			data: {
				object: {
					customer: "cus_123",
					parent: {
						subscription_details: {
							subscription: "sub_123",
						},
					},
				},
			},
			type: "invoice.payment_failed",
		});

		const response = await POST(createRequest(JSON.stringify({ id: "evt_failed" })));

		expect(response.status).toBe(200);
		expect(mockSubscriptionsUpdate).toHaveBeenCalledWith(
			expect.objectContaining({
				status: "past_due",
				updated_at: expect.any(String),
			}),
		);
		expect(mockSubscriptionsUpdateEq).toHaveBeenCalledWith("stripe_subscription_id", "sub_123");
		await expect(response.json()).resolves.toEqual({ received: true });
	});

	it("ignores unknown event types without crashing", async () => {
		mockConstructEvent.mockReturnValue({
			data: {
				object: { id: "prod_123" },
			},
			type: "product.created",
		});

		const response = await POST(createRequest(JSON.stringify({ id: "evt_unknown" })));

		expect(response.status).toBe(200);
		expect(mockSubscriptionsUpsert).not.toHaveBeenCalled();
		expect(mockProfilesUpdate).not.toHaveBeenCalled();
		await expect(response.json()).resolves.toEqual({ received: true });
	});
});
