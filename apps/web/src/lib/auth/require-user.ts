import { createClient } from "@/lib/supabase/server";
import type { User } from "@supabase/supabase-js";

/**
 * Centralized auth guard for server actions.
 *
 * Returns the authenticated Supabase User or throws "Not authenticated".
 * Designed to be called inside the try/catch of exported server actions —
 * the thrown error gets caught and returned as a structured error response.
 *
 * Usage:
 *   const user = await requireUser();
 */
export async function requireUser(): Promise<User> {
	const supabase = await createClient();
	const {
		data: { user },
	} = await supabase.auth.getUser();

	if (!user) {
		throw new Error("Not authenticated");
	}

	return user;
}
