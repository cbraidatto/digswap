import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { redirect } from "next/navigation";
import { TradeForm } from "./_components/trade-form";

interface NewTradePageProps {
	searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export default async function NewTradePage({ searchParams }: NewTradePageProps) {
	const supabase = await createClient();
	const {
		data: { user },
	} = await supabase.auth.getUser();

	if (!user) redirect("/signin");

	const rawParams = await searchParams;
	const toUserId = typeof rawParams.to === "string" ? rawParams.to : undefined;
	const releaseId =
		typeof rawParams.release === "string" ? rawParams.release : undefined;

	const admin = createAdminClient();

	// Fetch counterparty profile if provided
	let counterparty: { username: string | null; avatarUrl: string | null } | null =
		null;
	if (toUserId) {
		const { data } = await admin
			.from("profiles")
			.select("username, avatar_url")
			.eq("id", toUserId)
			.single();
		if (data) {
			counterparty = {
				username: data.username,
				avatarUrl: data.avatar_url,
			};
		}
	}

	// Fetch release info if provided
	let releaseInfo: { title: string; artist: string } | null = null;
	if (releaseId) {
		const { data } = await admin
			.from("releases")
			.select("title, artist")
			.eq("id", releaseId)
			.single();
		if (data) {
			releaseInfo = { title: data.title, artist: data.artist };
		}
	}

	return (
		<div className="max-w-4xl mx-auto px-4 md:px-8 py-8">
			<div className="mb-8">
				<span className="text-[10px] font-mono text-primary tracking-[0.2em] uppercase">
					Protocol / Trade
				</span>
				<h1 className="text-3xl font-bold font-heading text-on-surface mt-1 uppercase">
					INITIALIZE_TRADE
				</h1>
				<p className="text-on-surface-variant font-mono text-xs mt-2">
					Propose a P2P audio file exchange. Both parties must be online to
					complete the transfer.
				</p>
			</div>

			<TradeForm
				toUserId={toUserId ?? null}
				releaseId={releaseId ?? null}
				counterpartyUsername={counterparty?.username ?? null}
				counterpartyAvatar={counterparty?.avatarUrl ?? null}
				releaseTitle={releaseInfo?.title ?? null}
				releaseArtist={releaseInfo?.artist ?? null}
			/>
		</div>
	);
}
