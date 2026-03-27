import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getTradeInbox } from "@/lib/trades/queries";

export async function GET(request: NextRequest) {
	const supabase = await createClient();
	const {
		data: { user },
	} = await supabase.auth.getUser();

	if (!user) {
		return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
	}

	const tab = request.nextUrl.searchParams.get("tab") as
		| "pending"
		| "active"
		| "completed"
		| null;

	if (!tab || !["pending", "active", "completed"].includes(tab)) {
		return NextResponse.json(
			{ error: "Invalid tab parameter" },
			{ status: 400 },
		);
	}

	const trades = await getTradeInbox(user.id, tab);

	return NextResponse.json({ trades });
}
