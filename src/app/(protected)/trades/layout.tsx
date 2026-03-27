import { isP2PEnabled } from "@/lib/trades/constants";
import { createClient } from "@/lib/supabase/server";
import { P2PDisabledBanner } from "./_components/p2p-disabled-banner";
import { ToSModal } from "./_components/tos-modal";

export default async function TradesLayout({
	children,
}: {
	children: React.ReactNode;
}) {
	// D-03 server-side P2P gate enforcement per SEC-05
	if (!isP2PEnabled()) {
		return (
			<div className="min-h-screen">
				<P2PDisabledBanner />
			</div>
		);
	}

	// Fetch user profile to check trades_tos_accepted_at
	const supabase = await createClient();
	const {
		data: { user },
	} = await supabase.auth.getUser();

	let tosAccepted = false;

	if (user) {
		const { data: profile } = await supabase
			.from("profiles")
			.select("trades_tos_accepted_at")
			.eq("id", user.id)
			.single();

		tosAccepted = !!profile?.trades_tos_accepted_at;
	}

	return (
		<div className="min-h-screen">
			<ToSModal tosAccepted={tosAccepted} />
			{children}
		</div>
	);
}
