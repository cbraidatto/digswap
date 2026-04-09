import "server-only";

import { createClient } from "@supabase/supabase-js";
import { env, publicEnv } from "@/lib/env";

/**
 * Creates a Supabase client with the service role key.
 * This client bypasses Row Level Security -- use with extreme caution.
 *
 * WARNING: Never import this on the client side. Never use in client components.
 * Only use in Server Actions, API routes, and server-side utilities.
 */
export function createAdminClient() {
	return createClient(publicEnv.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
		auth: {
			autoRefreshToken: false,
			persistSession: false,
		},
	});
}
