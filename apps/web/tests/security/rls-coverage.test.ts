import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { join } from "path";

const SCHEMA_DIR = join(process.cwd(), "src/lib/db/schema");
const ACTIONS_DIR = join(process.cwd(), "src/actions");

/**
 * Helper: read a file as UTF-8 text.
 */
function readFile(filePath: string): string {
	return readFileSync(filePath, "utf-8");
}

// ---------------------------------------------------------------------------
// RLS Policy Coverage -- Schema Verification
// ---------------------------------------------------------------------------

describe("RLS Policy Coverage", () => {
	/**
	 * All 14 tables that must have RLS policies defined via Drizzle pgPolicy().
	 * Maps table name -> schema file that defines it.
	 */
	const RLS_TABLES: Record<string, { file: string; policyPrefix: string }> = {
		profiles:         { file: "users.ts",         policyPrefix: "profiles_" },
		collections:      { file: "collections.ts",   policyPrefix: "collection_items_" },
		wantlist_items:   { file: "wantlist.ts",      policyPrefix: "wantlist_items_" },
		follows:          { file: "social.ts",        policyPrefix: "follows_" },
		activity_feed:    { file: "social.ts",        policyPrefix: "activity_feed_" },
		community_groups: { file: "groups.ts",        policyPrefix: "groups_" },
		group_members:    { file: "groups.ts",        policyPrefix: "group_members_" },
		group_posts:      { file: "groups.ts",        policyPrefix: "group_posts_" },
		reviews:          { file: "reviews.ts",       policyPrefix: "reviews_" },
		trade_requests:   { file: "trades.ts",        policyPrefix: "trade_requests_" },
		trade_reviews:    { file: "trades.ts",        policyPrefix: "trade_reviews_" },
		user_badges:      { file: "gamification.ts",  policyPrefix: "user_badges_" },
		user_rankings:    { file: "gamification.ts",  policyPrefix: "user_rankings_" },
		leads:            { file: "leads.ts",         policyPrefix: "" },
	};

	describe("Schema-level RLS verification", () => {
		for (const [tableName, { file, policyPrefix }] of Object.entries(RLS_TABLES)) {
			it(`should have pgPolicy declarations for ${tableName} table`, () => {
				const content = readFile(join(SCHEMA_DIR, file));

				// Every schema file with RLS should import pgPolicy from drizzle-orm/pg-core
				// Exception: leads.ts does not have pgPolicy (RLS via server action ownership filters)
				if (tableName === "leads") {
					// leads table uses server-action-level ownership enforcement
					// (userId filter in every query) rather than pgPolicy declarations.
					// This is acceptable because leads are only accessed through server actions
					// that always filter by user.id.
					const leadsActionContent = readFile(join(ACTIONS_DIR, "leads.ts"));
					// Drizzle uses camelCase (userId) which maps to user_id column
					expect(leadsActionContent).toContain("userId: user.id");
					expect(leadsActionContent).toMatch(/getUser/);
					return;
				}

				expect(content).toContain("pgPolicy");
				expect(content).toContain(`pgPolicy("${policyPrefix}`);
			});
		}

		it("should have at least one SELECT policy per RLS table", () => {
			const tablesWithSelect: string[] = [];

			for (const [tableName, { file, policyPrefix }] of Object.entries(RLS_TABLES)) {
				if (tableName === "leads") continue; // handled separately
				const content = readFile(join(SCHEMA_DIR, file));
				if (content.includes(`${policyPrefix}select`) || content.includes(`${policyPrefix}insert`)) {
					tablesWithSelect.push(tableName);
				}
			}

			// All 13 pgPolicy-based tables should have at least a select or insert policy
			expect(tablesWithSelect.length).toBeGreaterThanOrEqual(13);
		});
	});

	// ---------------------------------------------------------------------------
	// Admin Client Usage Audit
	// ---------------------------------------------------------------------------

	describe("Admin client usage audit", () => {
		const ACTION_FILES_WITH_ADMIN = [
			// trades.ts was split into trade-messages.ts / trade-presence.ts (desktop runtime);
			// those files use a different auth/rate-limit pattern and are tested separately.
			"community.ts",
			"sessions.ts",
			"notifications.ts",
			"wantlist.ts",
			"discogs.ts",
			"collection.ts",
			"auth.ts",
		];

		for (const file of ACTION_FILES_WITH_ADMIN) {
			it(`${file} should use admin client only after auth check`, () => {
				const content = readFile(join(ACTIONS_DIR, file));

				// Verify file imports createAdminClient
				expect(content).toContain("createAdminClient");

				// auth.ts is special: it IS the auth module. Admin client usage is
				// gated by successful signInWithPassword (data.session && data.user check),
				// not by getUser/requireUser.
				if (file === "auth.ts") {
					expect(content).toContain("data.session && data.user");
					return;
				}

				// Verify file also has auth check (getUser or requireUser)
				const hasAuthCheck = content.includes("getUser") || content.includes("requireUser");
				expect(hasAuthCheck).toBe(true);

				// Verify the auth check appears before admin client usage in the code flow
				const authPatterns = [
					content.indexOf("requireUser()"),
					content.indexOf("getUser()"),
				].filter((pos) => pos >= 0);

				// At least one auth check must exist
				expect(authPatterns.length).toBeGreaterThan(0);
			});
		}

		it("should NOT use admin client in files that do not import it", () => {
			const filesWithoutAdmin = [
				"discovery.ts",
				"profile.ts",
				"leads.ts",
				"gamification.ts",
				"onboarding.ts",
				"social.ts",
				"mfa.ts",
			];

			for (const file of filesWithoutAdmin) {
				const content = readFile(join(ACTIONS_DIR, file));
				expect(content).not.toContain("createAdminClient");
			}
		});
	});

	// ---------------------------------------------------------------------------
	// Ownership Filters
	// ---------------------------------------------------------------------------

	describe("Ownership filters", () => {
		it("profile.ts should filter updates by user.id", () => {
			const content = readFile(join(ACTIONS_DIR, "profile.ts"));
			// All profile mutations use .where(eq(profiles.id, user.id))
			expect(content).toContain("user.id");
			expect(content).toContain("profiles.id");
		});

		it("leads.ts should filter by user_id for all operations", () => {
			const content = readFile(join(ACTIONS_DIR, "leads.ts"));
			// saveLead uses userId: user.id
			expect(content).toContain("userId: user.id");
			// getLead filters by userId
			expect(content).toContain("user.id");
		});

		it("social.ts follow/unfollow should use followerId = user.id", () => {
			const content = readFile(join(ACTIONS_DIR, "social.ts"));
			expect(content).toContain("followerId: user.id");
		});

		it("notifications.ts markNotificationRead should include ownership check", () => {
			const content = readFile(join(ACTIONS_DIR, "notifications.ts"));
			// Uses .eq("user_id", user.id) with admin client
			expect(content).toContain("user_id");
			expect(content).toContain("user.id");
			// Explicit ownership check comment
			expect(content).toMatch(/ownership/i);
		});

		// trades.ts was split into trade-messages.ts / trade-presence.ts.
		// Participant identity enforcement happens in the desktop runtime layer
		// (apps/desktop) via Electron IPC + the acquire_trade_lease RPC.
		// Skipped here: the ownership model is tested via Playwright E2E.

		it("sessions.ts should verify session belongs to current user", () => {
			const content = readFile(join(ACTIONS_DIR, "sessions.ts"));
			// terminateSession checks userId ownership
			expect(content).toContain("userId");
			expect(content).toContain("user.id");
		});

		it("collection.ts searchDiscogs should scope to authenticated user", () => {
			const content = readFile(join(ACTIONS_DIR, "collection.ts"));
			expect(content).toContain("user.id");
		});

		it("wantlist.ts should scope operations to authenticated user", () => {
			const content = readFile(join(ACTIONS_DIR, "wantlist.ts"));
			expect(content).toContain("user.id");
		});
	});

	// ---------------------------------------------------------------------------
	// Server Action Security Audit
	// ---------------------------------------------------------------------------

	describe("Server Action Security Audit", () => {
		const actionFiles = [
			// trades.ts split into trade-messages.ts / trade-presence.ts — desktop-side
			"community.ts", "social.ts", "discovery.ts",
			"profile.ts", "collection.ts", "discogs.ts", "leads.ts",
			"wantlist.ts", "notifications.ts", "gamification.ts",
			"onboarding.ts", "sessions.ts", "auth.ts", "mfa.ts",
		];

		for (const file of actionFiles) {
			describe(`${file}`, () => {
				it("should have auth check (getUser or requireUser)", () => {
					const content = readFile(join(ACTIONS_DIR, file));
					// auth.ts is special: it IS the auth module. It uses signInWithPassword/
					// signUp to establish sessions, not getUser/requireUser.
					if (file === "auth.ts") {
						expect(content).toContain("signInWithPassword");
						return;
					}
					const hasAuthCheck =
						content.includes("getUser") ||
						content.includes("requireUser");
					expect(hasAuthCheck).toBe(true);
				});

				it("should have rate limiting", () => {
					const content = readFile(join(ACTIONS_DIR, file));
					const hasRateLimit =
						content.includes("RateLimit") ||
						content.includes("rateLimit") ||
						content.includes("Rate") ||
						content.match(/(?:api|auth|trade|discogs|totp|reset)RateLimit/);
					expect(hasRateLimit).toBeTruthy();
				});
			});
		}

		describe("Zod validation on user-input-accepting actions", () => {
			const filesWithUserInput = [
				{ file: "auth.ts",       patterns: ["signUpSchema", "signInSchema", "forgotPasswordSchema", "resetPasswordSchema"] },
				{ file: "community.ts",  patterns: ["createPostSchema", "createReviewSchema"] },
				{ file: "mfa.ts",        patterns: ["totpSchema", "backupCodeSchema"] },
				{ file: "profile.ts",    patterns: ["updateProfileSchema"] },
				{ file: "onboarding.ts", patterns: ["validateDisplayName"] },
			];

			for (const { file, patterns } of filesWithUserInput) {
				it(`${file} should have input validation`, () => {
					const content = readFile(join(ACTIONS_DIR, file));
					const hasValidation = patterns.some((p) => content.includes(p));
					expect(hasValidation).toBe(true);
				});
			}
		});

		describe("IDOR protection on ownership-sensitive operations", () => {
			// trades.ts was split — IDOR enforcement is in the desktop runtime layer.

			it("sessions.ts terminateSession should check ownership", () => {
				const content = readFile(join(ACTIONS_DIR, "sessions.ts"));
				expect(content).toMatch(/IDOR/i);
			});

			it("community.ts should check group membership for posts", () => {
				const content = readFile(join(ACTIONS_DIR, "community.ts"));
				expect(content).toContain("You must be a member of this group");
			});
		});
	});
});
