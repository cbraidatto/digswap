import { Redis } from "@upstash/redis";
import { ImageResponse } from "next/og";
import { env } from "@/lib/env";

export const runtime = "edge";

/**
 * Verify HMAC signature on OG image query params.
 * Prevents fake stat cards — only the server can generate valid signatures.
 * sig = HMAC-SHA256(username:total:gems:avg, secret).slice(0, 16)
 */
async function verifyOgSignature(
	username: string,
	total: string,
	gems: string,
	avg: string,
	sig: string | null,
): Promise<boolean> {
	const secret = env.HANDOFF_HMAC_SECRET;
	if (!secret) return true; // fail-open in dev (no secret configured)
	if (!sig) return false;

	const encoder = new TextEncoder();
	const key = await crypto.subtle.importKey(
		"raw",
		encoder.encode(secret),
		{ name: "HMAC", hash: "SHA-256" },
		false,
		["sign"],
	);
	const data = encoder.encode(`${username}:${total}:${gems}:${avg}`);
	const signature = await crypto.subtle.sign("HMAC", key, data);
	const expected = Array.from(new Uint8Array(signature))
		.map((b) => b.toString(16).padStart(2, "0"))
		.join("")
		.slice(0, 16);

	return sig === expected;
}

// OG image route — no DB imports (WASM bundle conflict).
// Stats are passed as query params, computed server-side by the caller.
// URL: /api/og/rarity/[username]?total=N&ultra=N&avg=N.N&name=Display+Name

// Rate limit: 60 requests per minute per IP for OG image generation.
// Without this, the endpoint can be used for compute-level DoS since
// ImageResponse is CPU-intensive (Satori renders a full image per request).
async function checkRateLimit(ip: string): Promise<boolean> {
	const url = env.UPSTASH_REDIS_REST_URL;
	const token = env.UPSTASH_REDIS_REST_TOKEN;
	if (!url || !token) return true; // fail-open if Redis not configured

	try {
		const redis = new Redis({ url, token });
		const key = `ratelimit:og:${ip}`;
		const count = await redis.incr(key);
		if (count === 1) {
			await redis.expire(key, 60); // reset window every 60s
		}
		return count <= 60;
	} catch {
		return true; // fail-open on Redis error
	}
}

export async function GET(request: Request, context: { params: Promise<{ username: string }> }) {
	// Rate limit by IP — OG image rendering is CPU-intensive
	const ip =
		(request as Request & { headers: Headers }).headers
			.get("x-forwarded-for")
			?.split(",")[0]
			?.trim() ?? "unknown";
	const allowed = await checkRateLimit(ip);
	if (!allowed) {
		return new Response("Too many requests", { status: 429 });
	}

	// Validate and sanitize numeric query params to prevent NaN/Infinity
	// rendering in the image (fake stat card protection)
	const { username } = await context.params;
	const { searchParams } = new URL(request.url);

	// SECURITY: Verify HMAC signature to prevent forged stat cards.
	// Without this, anyone can craft a URL with arbitrary stats.
	const sig = searchParams.get("sig");
	const sigValid = await verifyOgSignature(
		username,
		searchParams.get("total") ?? "0",
		searchParams.get("gems") ?? "0",
		searchParams.get("avg") ?? "0",
		sig,
	);
	if (!sigValid) {
		return new Response("Invalid signature", { status: 403 });
	}

	const displayName = String(searchParams.get("name") ?? username).slice(0, 60);
	const rawTotal = parseInt(searchParams.get("total") ?? "0", 10);
	const rawGems = parseInt(searchParams.get("gems") ?? "0", 10);
	const rawAvg = parseFloat(searchParams.get("avg") ?? "0");
	const totalRecords = isNaN(rawTotal) || rawTotal < 0 ? 0 : Math.min(rawTotal, 999999);
	const gemScore = isNaN(rawGems) || rawGems < 0 ? 0 : Math.min(rawGems, 999999);
	const avgRarity = isNaN(rawAvg) || rawAvg < 0 ? 0 : Math.min(rawAvg, 100);
	const obscurityPercentile = Math.min(99, Math.round(avgRarity));
	const avgDisplay = avgRarity > 0 ? avgRarity.toFixed(1) : "-";

	return new ImageResponse(
		<div
			style={{
				width: "1200px",
				height: "630px",
				backgroundColor: "#10141a",
				display: "flex",
				flexDirection: "column",
				justifyContent: "space-between",
				padding: "60px",
				fontFamily: "monospace",
			}}
		>
			<div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
				<div style={{ color: "#6fdd78", fontSize: "14px", letterSpacing: "0.2em" }}>
					[GEM_SCORE_CARD]
				</div>
				<div style={{ color: "#dfe2eb", fontSize: "48px", fontWeight: 700 }}>{displayName}</div>
				<div style={{ color: "#8a9099", fontSize: "16px" }}>@{username}</div>
			</div>

			<div style={{ display: "flex", gap: "48px", alignItems: "flex-end" }}>
				<div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
					<div style={{ color: "#6fdd78", fontSize: "64px", fontWeight: 700 }}>
						{obscurityPercentile}%
					</div>
					<div style={{ color: "#8a9099", fontSize: "12px", letterSpacing: "0.15em" }}>
						MORE OBSCURE THAN NETWORK
					</div>
				</div>
				<div
					style={{ display: "flex", flexDirection: "column", gap: "16px", paddingBottom: "8px" }}
				>
					<div style={{ display: "flex", flexDirection: "column", gap: "2px" }}>
						<div style={{ color: "#dfe2eb", fontSize: "28px", fontWeight: 600 }}>
							{String(totalRecords)}
						</div>
						<div style={{ color: "#8a9099", fontSize: "11px", letterSpacing: "0.12em" }}>
							RECORDS IN COLLECTION
						</div>
					</div>
					<div style={{ display: "flex", flexDirection: "column", gap: "2px" }}>
						<div style={{ color: "#ffb689", fontSize: "28px", fontWeight: 600 }}>
							{String(gemScore)}
						</div>
						<div style={{ color: "#8a9099", fontSize: "11px", letterSpacing: "0.12em" }}>
							GEM SCORE
						</div>
					</div>
					<div style={{ display: "flex", flexDirection: "column", gap: "2px" }}>
						<div style={{ color: "#aac7ff", fontSize: "28px", fontWeight: 600 }}>{avgDisplay}</div>
						<div style={{ color: "#8a9099", fontSize: "11px", letterSpacing: "0.12em" }}>
							AVG RARITY SCORE
						</div>
					</div>
				</div>
			</div>

			<div style={{ color: "#8a9099", fontSize: "14px", letterSpacing: "0.1em" }}>
				{"digswap.com // find who has your Holy Grails"}
			</div>
		</div>,
		{ width: 1200, height: 630 },
	);
}
