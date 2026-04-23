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

	// ---- Phase 33.1 / DEP-AUD-05 hardening contract ----
	// storeTokens() MUST NOT have a silent plaintext fallback. If Vault fails
	// for any reason, the function aborts (throws). The plaintext discogs_tokens
	// table is treated as an emergency-only migration target, never as a runtime
	// fallback. This pins the contract so Pitfall #11 cannot regress.

	test("storeTokens (vault success path): writes both secrets to Vault, never touches discogs_tokens", async () => {
		mockRpc.mockResolvedValue({ error: null });
		const mockUpsert = vi.fn().mockResolvedValue({ error: null });
		mockFrom.mockReturnValue({ upsert: mockUpsert });

		await expect(storeTokens("user-123", "access_tok", "access_sec")).resolves.toBeUndefined();

		expect(mockRpc).toHaveBeenCalledWith("vault_create_secret", {
			secret: "access_tok",
			name: "discogs_token:user-123",
		});
		expect(mockRpc).toHaveBeenCalledWith("vault_create_secret", {
			secret: "access_sec",
			name: "discogs_secret:user-123",
		});
		// Critical assertion: no plaintext write side-effect on success path
		expect(mockFrom).not.toHaveBeenCalledWith("discogs_tokens");
		expect(mockUpsert).not.toHaveBeenCalled();
	});

	test("storeTokens (vault PRIMARY-token failure): rejects with Vault error and does NOT write plaintext", async () => {
		// First (and only) rpc call returns an error -> primary token write failed
		mockRpc.mockResolvedValueOnce({
			error: { message: "vault extension not installed", code: "42P01" },
		});
		const mockUpsert = vi.fn().mockResolvedValue({ error: null });
		mockFrom.mockReturnValue({ upsert: mockUpsert });

		await expect(storeTokens("user-123", "access_tok", "access_sec")).rejects.toThrow(
			/Vault unavailable/,
		);

		// CRITICAL: no fallback into the plaintext discogs_tokens table
		expect(mockFrom).not.toHaveBeenCalledWith("discogs_tokens");
		expect(mockUpsert).not.toHaveBeenCalled();
	});

	test("storeTokens (vault SECONDARY-secret failure): rejects + cleans up first secret + does NOT write plaintext", async () => {
		// First rpc resolves OK (primary token written), second rpc fails (secret write fails)
		mockRpc
			.mockResolvedValueOnce({ error: null })
			.mockResolvedValueOnce({ error: { message: "secret write failed" } })
			// Third rpc is the cleanup vault_delete_secret -> resolve to no-op
			.mockResolvedValueOnce({ error: null });

		const mockUpsert = vi.fn().mockResolvedValue({ error: null });
		mockFrom.mockReturnValue({ upsert: mockUpsert });

		await expect(storeTokens("user-456", "access_tok", "access_sec")).rejects.toThrow(
			/Vault unavailable/,
		);

		// Cleanup: must have attempted vault_delete_secret on the first secret
		expect(mockRpc).toHaveBeenCalledWith("vault_delete_secret", {
			name: "discogs_token:user-456",
		});

		// CRITICAL: no fallback into the plaintext discogs_tokens table
		expect(mockFrom).not.toHaveBeenCalledWith("discogs_tokens");
		expect(mockUpsert).not.toHaveBeenCalled();
	});

	test("storeTokens (vault primary failure): error message surfaces underlying Vault failure cause", async () => {
		mockRpc.mockResolvedValueOnce({
			error: { message: "permission denied for function vault_create_secret", code: "42501" },
		});

		await expect(storeTokens("user-789", "access_tok", "access_sec")).rejects.toThrow(
			/permission denied for function vault_create_secret/,
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
