import { beforeEach, describe, expect, it, vi } from "vitest";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------
const USER_ID = "user-1111-1111-1111-1111";
const USER_EMAIL = "digger@test.com";
const PRICE_MONTHLY = "price_monthly_test_123";
const PRICE_ANNUAL = "price_annual_test_456";
const STRIPE_CUSTOMER_ID = "cus_test_abc123";
const CHECKOUT_URL = "https://checkout.stripe.com/session/test_sess";
const PORTAL_URL = "https://billing.stripe.com/portal/test_sess";
const SITE_URL = "http://localhost:3000";

// ---------------------------------------------------------------------------
// Auth mock
// ---------------------------------------------------------------------------
let mockAuthUser: { id: string; email?: string } | null = {
	id: USER_ID,
	email: USER_EMAIL,
};

vi.mock("@/lib/auth/require-user", () => ({
	requireUser: vi.fn(async () => {
		if (!mockAuthUser) throw new Error("Not authenticated");
		return mockAuthUser;
	}),
}));

// ---------------------------------------------------------------------------
// Stripe mock
// ---------------------------------------------------------------------------
const mockCheckoutCreate = vi.fn();
const mockPortalCreate = vi.fn();
const mockCustomerCreate = vi.fn();

vi.mock("@/lib/stripe", () => ({
	getStripe: vi.fn(() => ({
		checkout: { sessions: { create: mockCheckoutCreate } },
		billingPortal: { sessions: { create: mockPortalCreate } },
		customers: { create: mockCustomerCreate },
	})),
	getSiteUrl: vi.fn(() => SITE_URL),
	getStripePriceIds: vi.fn(() => ({
		premiumMonthly: PRICE_MONTHLY,
		premiumAnnual: PRICE_ANNUAL,
	})),
}));

// ---------------------------------------------------------------------------
// DB mock (Drizzle chain pattern)
// ---------------------------------------------------------------------------
let selectResults: unknown[][] = [];
let queryCallCount = 0;
const mockInsertValues = vi.fn();
const mockUpdateSet = vi.fn();
const mockUpdateWhere = vi.fn();

vi.mock("@/lib/db", () => {
	const chain: Record<string, unknown> = {};

	const methods = ["select", "from", "where", "orderBy", "limit", "innerJoin", "leftJoin"];
	for (const m of methods) {
		chain[m] = vi.fn().mockImplementation(() => chain);
	}

	chain.then = (resolve: (v: unknown) => void) => {
		const result = selectResults[queryCallCount] ?? [];
		queryCallCount++;
		return resolve(result);
	};

	chain.insert = vi.fn().mockImplementation(() => ({
		values: mockInsertValues.mockImplementation(() => ({
			returning: vi.fn().mockImplementation(() => ({
				then: (resolve: (v: unknown) => void) => {
					const result = selectResults[queryCallCount] ?? [];
					queryCallCount++;
					return resolve(result);
				},
			})),
			onConflictDoUpdate: vi.fn().mockImplementation(() => ({
				then: (resolve: (v: unknown) => void) => {
					const result = selectResults[queryCallCount] ?? [];
					queryCallCount++;
					return resolve(result);
				},
			})),
			then: (resolve: (v: unknown) => void) => {
				const result = selectResults[queryCallCount] ?? [];
				queryCallCount++;
				return resolve(result);
			},
		})),
	}));

	chain.update = vi.fn().mockImplementation(() => ({
		set: mockUpdateSet.mockImplementation(() => ({
			where: mockUpdateWhere.mockImplementation(() => ({
				then: (resolve: (v: unknown) => void) => {
					const result = selectResults[queryCallCount] ?? [];
					queryCallCount++;
					return resolve(result);
				},
			})),
		})),
	}));

	return { db: chain };
});

vi.mock("@/lib/db/schema/subscriptions", () => ({
	subscriptions: {
		id: "id",
		userId: "user_id",
		plan: "plan",
		status: "status",
		stripeCustomerId: "stripe_customer_id",
		updatedAt: "updated_at",
		tradesThisMonth: "trades_this_month",
		tradesMonthReset: "trades_month_reset",
	},
}));

// ---------------------------------------------------------------------------
// next/headers mock (required for server actions)
// ---------------------------------------------------------------------------
vi.mock("next/headers", () => ({
	cookies: vi.fn(() => ({
		get: vi.fn(),
		set: vi.fn(),
		delete: vi.fn(),
		getAll: vi.fn(() => []),
	})),
	headers: vi.fn(() => new Map()),
}));

// ---------------------------------------------------------------------------
// Import actions AFTER mocks
// ---------------------------------------------------------------------------
const { createCheckoutSession, createPortalSession } = await import("@/actions/stripe");

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------
describe("stripe actions", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		mockAuthUser = { id: USER_ID, email: USER_EMAIL };
		selectResults = [];
		queryCallCount = 0;
	});

	// -----------------------------------------------------------------------
	// createCheckoutSession
	// -----------------------------------------------------------------------
	describe("createCheckoutSession", () => {
		it("creates a checkout session with a valid monthly price", async () => {
			// Query 1: ensureSubscriptionRecord SELECT -> existing record with stripeCustomerId
			selectResults[0] = [
				{
					id: "sub-1",
					plan: "free",
					status: "active",
					stripeCustomerId: STRIPE_CUSTOMER_ID,
				},
			];

			mockCheckoutCreate.mockResolvedValue({ url: CHECKOUT_URL });

			const result = await createCheckoutSession(PRICE_MONTHLY);

			expect(result).toEqual({ url: CHECKOUT_URL });
			expect(mockCheckoutCreate).toHaveBeenCalledOnce();
			expect(mockCheckoutCreate).toHaveBeenCalledWith(
				expect.objectContaining({
					customer: STRIPE_CUSTOMER_ID,
					mode: "subscription",
					line_items: [{ price: PRICE_MONTHLY, quantity: 1 }],
					success_url: `${SITE_URL}/settings/billing?success=true`,
					cancel_url: `${SITE_URL}/pricing`,
					client_reference_id: USER_ID,
					metadata: { userId: USER_ID },
				}),
			);
		});

		it("creates a checkout session with a valid annual price", async () => {
			selectResults[0] = [
				{
					id: "sub-1",
					plan: "free",
					status: "active",
					stripeCustomerId: STRIPE_CUSTOMER_ID,
				},
			];

			mockCheckoutCreate.mockResolvedValue({ url: CHECKOUT_URL });

			const result = await createCheckoutSession(PRICE_ANNUAL);

			expect(result).toEqual({ url: CHECKOUT_URL });
			expect(mockCheckoutCreate).toHaveBeenCalledWith(
				expect.objectContaining({
					line_items: [{ price: PRICE_ANNUAL, quantity: 1 }],
				}),
			);
		});

		it("creates a new Stripe customer when subscription has no stripeCustomerId", async () => {
			// Query 1: ensureSubscriptionRecord SELECT -> exists but no stripeCustomerId
			selectResults[0] = [
				{
					id: "sub-1",
					plan: "free",
					status: "active",
					stripeCustomerId: null,
				},
			];
			// Query 2: update subscriptions SET stripeCustomerId (no result needed)
			selectResults[1] = [];

			mockCustomerCreate.mockResolvedValue({ id: STRIPE_CUSTOMER_ID });
			mockCheckoutCreate.mockResolvedValue({ url: CHECKOUT_URL });

			const result = await createCheckoutSession(PRICE_MONTHLY);

			expect(result).toEqual({ url: CHECKOUT_URL });
			expect(mockCustomerCreate).toHaveBeenCalledWith({
				email: USER_EMAIL,
				metadata: { userId: USER_ID },
			});
			expect(mockCheckoutCreate).toHaveBeenCalledWith(
				expect.objectContaining({
					customer: STRIPE_CUSTOMER_ID,
				}),
			);
		});

		it("inserts a new subscription record when none exists", async () => {
			// Query 1: ensureSubscriptionRecord SELECT -> no rows
			selectResults[0] = [];
			// Query 2: insert subscription (ensureSubscriptionRecord INSERT)
			selectResults[1] = [];
			// Query 3: ensureStripeCustomer calls ensureSubscriptionRecord again
			// but since insert happened, the returned object has stripeCustomerId: null
			// so it creates a customer
			// Query 3: update subscriptions SET stripeCustomerId
			selectResults[2] = [];

			mockCustomerCreate.mockResolvedValue({ id: STRIPE_CUSTOMER_ID });
			mockCheckoutCreate.mockResolvedValue({ url: CHECKOUT_URL });

			const result = await createCheckoutSession(PRICE_MONTHLY);

			expect(result).toEqual({ url: CHECKOUT_URL });
			expect(mockInsertValues).toHaveBeenCalled();
			expect(mockCustomerCreate).toHaveBeenCalled();
		});

		it("rejects an empty price ID", async () => {
			const result = await createCheckoutSession("");

			expect(result).toEqual({ error: "Invalid price." });
			expect(mockCheckoutCreate).not.toHaveBeenCalled();
		});

		it("rejects an unsupported price ID", async () => {
			const result = await createCheckoutSession("price_unknown_999");

			expect(result).toEqual({ error: "Unsupported billing plan." });
			expect(mockCheckoutCreate).not.toHaveBeenCalled();
		});

		it("returns an error when the user is not authenticated", async () => {
			mockAuthUser = null;

			const result = await createCheckoutSession(PRICE_MONTHLY);

			expect(result).toEqual({
				error: "Failed to create checkout session. Please try again.",
			});
			expect(mockCheckoutCreate).not.toHaveBeenCalled();
		});

		it("returns an error when Stripe does not return a session URL", async () => {
			selectResults[0] = [
				{
					id: "sub-1",
					plan: "free",
					status: "active",
					stripeCustomerId: STRIPE_CUSTOMER_ID,
				},
			];

			mockCheckoutCreate.mockResolvedValue({ url: null });

			const result = await createCheckoutSession(PRICE_MONTHLY);

			expect(result).toEqual({
				error: "Stripe checkout did not return a redirect URL.",
			});
		});

		it("returns a generic error when Stripe throws", async () => {
			selectResults[0] = [
				{
					id: "sub-1",
					plan: "free",
					status: "active",
					stripeCustomerId: STRIPE_CUSTOMER_ID,
				},
			];

			mockCheckoutCreate.mockRejectedValue(new Error("Stripe API down"));

			const result = await createCheckoutSession(PRICE_MONTHLY);

			expect(result).toEqual({
				error: "Failed to create checkout session. Please try again.",
			});
		});
	});

	// -----------------------------------------------------------------------
	// createPortalSession
	// -----------------------------------------------------------------------
	describe("createPortalSession", () => {
		it("returns a portal URL when the user has a Stripe customer", async () => {
			// Query 1: SELECT stripeCustomerId
			selectResults[0] = [{ stripeCustomerId: STRIPE_CUSTOMER_ID }];

			mockPortalCreate.mockResolvedValue({ url: PORTAL_URL });

			const result = await createPortalSession();

			expect(result).toEqual({ url: PORTAL_URL });
			expect(mockPortalCreate).toHaveBeenCalledWith({
				customer: STRIPE_CUSTOMER_ID,
				return_url: `${SITE_URL}/settings/billing`,
			});
		});

		it("returns an error when no Stripe customer exists", async () => {
			// Query 1: SELECT stripeCustomerId -> no rows
			selectResults[0] = [];

			const result = await createPortalSession();

			expect(result).toEqual({
				error: "No billing account found for this user.",
			});
			expect(mockPortalCreate).not.toHaveBeenCalled();
		});

		it("returns an error when stripeCustomerId is null", async () => {
			selectResults[0] = [{ stripeCustomerId: null }];

			const result = await createPortalSession();

			expect(result).toEqual({
				error: "No billing account found for this user.",
			});
			expect(mockPortalCreate).not.toHaveBeenCalled();
		});

		it("returns an error when the user is not authenticated", async () => {
			mockAuthUser = null;

			const result = await createPortalSession();

			expect(result).toEqual({
				error: "Failed to create billing portal session. Please try again.",
			});
			expect(mockPortalCreate).not.toHaveBeenCalled();
		});

		it("returns a generic error when Stripe throws", async () => {
			selectResults[0] = [{ stripeCustomerId: STRIPE_CUSTOMER_ID }];

			mockPortalCreate.mockRejectedValue(new Error("Stripe API down"));

			const result = await createPortalSession();

			expect(result).toEqual({
				error: "Failed to create billing portal session. Please try again.",
			});
		});
	});
});
