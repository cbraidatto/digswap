import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { verifyAndConsumeHandoffToken } from "@/lib/desktop/handoff-token";
import { tradeRateLimit } from "@/lib/rate-limit";

export const runtime = "nodejs";

interface ConsumeHandoffBody {
  tradeId?: string;
  token?: string;
}

export async function POST(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  const accessToken = authHeader?.startsWith("Bearer ")
    ? authHeader.slice("Bearer ".length)
    : null;

  if (!accessToken) {
    return NextResponse.json({ error: "Missing bearer token" }, { status: 401 });
  }

  let body: ConsumeHandoffBody;
  try {
    body = (await request.json()) as ConsumeHandoffBody;
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const tradeId = body.tradeId?.trim();
  const token = body.token?.trim();

  if (!tradeId || !token) {
    return NextResponse.json({ error: "tradeId and token are required" }, { status: 400 });
  }

  const admin = createAdminClient();
  const {
    data: { user },
    error: userError,
  } = await admin.auth.getUser(accessToken);

  if (userError || !user) {
    return NextResponse.json({ error: "Invalid desktop session" }, { status: 401 });
  }

  // SEC-04: rate limit by user ID — prevents brute force of handoff tokens
  const { success: rlSuccess } = await tradeRateLimit.limit(user.id);
  if (!rlSuccess) {
    return NextResponse.json({ error: "Too many requests" }, { status: 429 });
  }

  const consumed = await verifyAndConsumeHandoffToken(token, tradeId, user.id);

  if (!consumed) {
    return NextResponse.json(
      { error: "Handoff token is invalid, expired, or already used" },
      { status: 400 },
    );
  }

  return NextResponse.json({
    ok: true,
    tradeId,
    userId: user.id,
  });
}
