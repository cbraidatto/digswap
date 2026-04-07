import { beforeEach, describe, expect, test, vi } from "vitest";

// Use vi.hoisted so these are available when vi.mock factory runs (hoisted above imports)
const { mockGetRequestToken, mockGetAccessToken, mockRpc, mockFrom } = vi.hoisted(() => ({
	mockGetRequestToken: vi.fn(),
	mockGetAccessToken: vi.fn(),
	mockRpc: vi.fn(),
	mockFrom: vi.fn(),
}));

vi.mock("@lionralfs/discogs-client", () => {
	return {
		DiscogsOAuth: class MockDiscogsOAuth {
			getRequestToken = mockGetRequestToken;
			getAccessToken = mockGetAccessToken;
		},
	};
});

vi.mock("@/lib/supabase/admin", () => ({
	createAdminClient: vi.fn(() => ({
		rpc: mockRpc,
		from: mockFrom,
	})),
}));

import { deleteTokens, getAccessToken, getRequestToken, storeTokens } from "@/lib/discogs/oauth";

describe("Discogs OAuth helpers", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		process.env.DISCOGS_CONSUMER_KEY = "test_key";
		process.env.DISCOGS_CONSUMER_SECRET = "test_secret";
	});

	test("getRequestToken returns token and authorizeUrl", async () => {
		mockGetRequestToken.mockResolvedValue({
			token: "req_token_123",
			tokenSecret: "req_secret_456",
			authorizeUrl: "https://discogs.com/oauth/authorize?oauth_token=req_token_123",
		});

		const result = await getRequestToken("http://localhost:3000/api/discogs/callback");

		expect(result).toEqual({
			token: "req_token_123",
			tokenSecret: "req_secret_456",
			authorizeUrl: "https://discogs.com/oauth/authorize?oauth_token=req_token_123",
		});
		expect(mockGetRequestToken).toHaveBeenCalledWith("http://localhost:3000/api/discogs/callback");
	});

	test("getRequestToken throws when token is missing", async () => {
		mockGetRequestToken.mockResolvedValue({
			token: null,
			tokenSecret: null,
			authorizeUrl: "",
		});

		await expect(getRequestToken("http://localhost:3000/api/discogs/callback")).rejects.toThrow(
			"Failed to obtain request token from Discogs",
		);
	});

	test("getAccessToken exchanges verifier for access token", async () => {
		mockGetAccessToken.mockResolvedValue({
			accessToken: "access_token_abc",
			accessTokenSecret: "access_secret_def",
		});

		const result = await getAccessToken("req_token", "req_secret", "verifier_code");

		expect(result).toEqual({
			accessToken: "access_token_abc",
			accessTokenSecret: "access_secret_def",
		});
		expect(mockGetAccessToken).toHaveBeenCalledWith("req_token", "req_secret", "verifier_code");
	});

	test("getAccessToken throws when access token is missing", async () => {
		mockGetAccessToken.mockResolvedValue({
			accessToken: null,
			accessTokenSecret: null,
		});

		await expect(getAccessToken("req_token", "req_secret", "verifier_code")).rejects.toThrow(
			"Failed to obtain access token from Discogs",
		);
	});

	test("storeTokens stores in Vault via admin client RPC", async () => {
		mockRpc.mockResolvedValue({ error: null });

		await storeTokens("user-123", "access_tok", "access_sec");

		expect(mockRpc).toHaveBeenCalledWith("vault_create_secret", {
			secret: "access_tok",
			name: "discogs_token:user-123",
		});
		expect(mockRpc).toHaveBeenCalledWith("vault_create_secret", {
			secret: "access_sec",
			name: "discogs_secret:user-123",
		});
	});

	test("storeTokens falls back to table when Vault fails", async () => {
		mockRpc.mockResolvedValue({ error: { message: "Vault not available" } });

		const mockUpsert = vi.fn().mockResolvedValue({ error: null });
		mockFrom.mockReturnValue({ upsert: mockUpsert });

		await storeTokens("user-123", "access_tok", "access_sec");

		expect(mockFrom).toHaveBeenCalledWith("discogs_tokens");
		expect(mockUpsert).toHaveBeenCalledWith(
			expect.objectContaining({
				user_id: "user-123",
				access_token: "access_tok",
				access_token_secret: "access_sec",
			}),
			{ onConflict: "user_id" },
		);
	});

	test("deleteTokens cleans up Vault secrets and fallback table", async () => {
		mockRpc.mockResolvedValue({ error: null });

		const mockDelete = vi.fn().mockReturnValue({
			eq: vi.fn().mockResolvedValue({ error: null }),
		});
		mockFrom.mockReturnValue({ delete: mockDelete });

		await deleteTokens("user-456");

		expect(mockRpc).toHaveBeenCalledWith("vault_delete_secret", {
			name: "discogs_token:user-456",
		});
		expect(mockRpc).toHaveBeenCalledWith("vault_delete_secret", {
			name: "discogs_secret:user-456",
		});

		expect(mockFrom).toHaveBeenCalledWith("discogs_tokens");
	});
});
