import { sql } from "drizzle-orm";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";

/**
 * Health check endpoint for uptime monitoring and Vercel health checks.
 *
 * GET /api/health — returns service status and DB connectivity.
 * No auth required — must be publicly accessible for monitoring.
 */
export async function GET() {
	const checks: Record<string, "ok" | "error"> = {};

	// Database connectivity
	try {
		await db.execute(sql`SELECT 1`);
		checks.database = "ok";
	} catch {
		checks.database = "error";
	}

	const allOk = Object.values(checks).every((v) => v === "ok");

	return NextResponse.json(
		{
			status: allOk ? "healthy" : "degraded",
			checks,
			timestamp: new Date().toISOString(),
		},
		{ status: allOk ? 200 : 503 },
	);
}
