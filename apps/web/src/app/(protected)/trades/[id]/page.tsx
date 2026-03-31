import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { getTradeThread } from "@/lib/trades/messages";
import { markTradeThreadRead } from "@/actions/trade-messages";
import { TradeDetailHeader } from "./_components/TradeDetailHeader";
import { TradeMessageThread } from "./_components/TradeMessageThread";
import { TradeMessageComposer } from "./_components/TradeMessageComposer";

interface Props {
	params: Promise<{ id: string }>;
}

export default async function TradeDetailPage({ params }: Props) {
	const { id } = await params;

	const supabase = await createClient();
	const {
		data: { user },
	} = await supabase.auth.getUser();
	if (!user) redirect("/signin");

	let thread;
	try {
		thread = await getTradeThread(id, user.id);
	} catch {
		notFound();
	}

	// Mark thread as read on load — fire and forget, never block render
	void markTradeThreadRead(id).catch(() => undefined);

	return (
		<div className="max-w-2xl mx-auto px-4 py-8">
			{/* Back nav */}
			<Link
				href="/trades"
				className="inline-flex items-center gap-1.5 text-[#4a4035] hover:text-[#7a6e5f] font-mono text-xs mb-6 transition-colors"
			>
				<span className="material-symbols-outlined text-sm">arrow_back</span>
				Trades
			</Link>

			<TradeDetailHeader thread={thread} />

			<div className="min-h-[300px]">
				<TradeMessageThread messages={thread.messages} />
			</div>

			<TradeMessageComposer tradeId={thread.tradeId} status={thread.status} />
		</div>
	);
}
