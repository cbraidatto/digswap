import { createClient } from "@/lib/supabase/server";
import { ExplorarClient } from "./_components/explorar-client";

export default async function ExplorarPage() {
	const supabase = await createClient();
	const {
		data: { user },
	} = await supabase.auth.getUser();

	return <ExplorarClient currentUserId={user?.id ?? null} />;
}
