import type { NextConfig } from "next";

const securityHeaders = [
	{
		key: "X-DNS-Prefetch-Control",
		value: "on",
	},
	{
		key: "Strict-Transport-Security",
		value: "max-age=63072000; includeSubDomains; preload",
	},
	{
		key: "X-Frame-Options",
		value: "DENY",
	},
	{
		key: "X-Content-Type-Options",
		value: "nosniff",
	},
	// NOTE: Referrer-Policy intentionally omitted here — middleware sets
	// strict-origin-when-cross-origin (stricter) on every response. Defining
	// it here with origin-when-cross-origin would create a conflicting value.
	// See security audit L-04 / middleware.ts SEC-02 block.
	{
		key: "Permissions-Policy",
		value: "camera=(), microphone=(), geolocation=()",
	},
	// CSP is now handled dynamically by middleware (nonce-based, per-request)
];

const nextConfig: NextConfig = {
	productionBrowserSourceMaps: false, // Never expose source maps in production (M-12/M-16)
	poweredByHeader: false, // Remove X-Powered-By fingerprinting (M-16)
	experimental: {
		serverActions: {
			bodySizeLimit: "6mb",
		},
	},
	images: {
		remotePatterns: [
			{
				protocol: "https",
				hostname: "i.discogs.com",
			},
			{
				protocol: "https",
				hostname: "st.discogs.com",
			},
			{
				protocol: "https",
				hostname: "i.ytimg.com",
			},
		],
	},
	async headers() {
		return [
			{
				source: "/(.*)",
				headers: securityHeaders,
			},
		];
	},
};

export default nextConfig;
