import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { getTradeById } from "@/lib/trades/queries";
import { getTurnCredentials, acceptTrade, declineTrade } from "@/actions/trades";
import { TradeLobby } from "./_components/trade-lobby";

function formatTimeRemaining(expiresAt: string | null): string | null {
	if (!expiresAt) return null;
	const now = Date.now();
	const expiry = new Date(expiresAt).getTime();
	const diffMs = expiry - now;
	if (diffMs <= 0) return "Expired";
	const hours = Math.floor(diffMs / (1000 * 60 * 60));
	const minutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
	if (hours > 0) return `Expires in ${hours}h ${minutes}m`;
	return `Expires in ${minutes}m`;
}

export default async function TradePage({
	params,
}: {
	params: Promise<{ id: string }>;
}) {
	const { id } = await params;
	const supabase = await createClient();
	const {
		data: { user },
	} = await supabase.auth.getUser();

	if (!user) {
		redirect("/signin");
	}

	// Fetch trade data (IDOR protection: only participants can access)
	const trade = await getTradeById(id, user.id);

	if (!trade) {
		redirect("/trades");
	}

	// Determine P2P role:
	//   requester = wants the file → receiver (downloads)
	//   provider  = has the file   → sender   (uploads & sends)
	const role: "sender" | "receiver" =
		user.id === trade.requesterId ? "receiver" : "sender";

	// Handle completed trades
	if (trade.status === "completed") {
		redirect(`/trades/${trade.id}/complete`);
	}

	// Handle terminal statuses
	if (
		trade.status === "declined" ||
		trade.status === "cancelled" ||
		trade.status === "expired"
	) {
		const statusLabels: Record<string, string> = {
			declined: "DECLINED",
			cancelled: "CANCELLED",
			expired: "EXPIRED",
		};
		const statusMessages: Record<string, string> = {
			declined: "This trade request was declined by the provider.",
			cancelled: "This trade request was cancelled by the requester.",
			expired: "This trade request has expired.",
		};

		return (
			<div className="max-w-2xl mx-auto px-4 md:px-8 py-16 text-center">
				<span className="material-symbols-outlined text-on-surface-variant text-5xl">
					block
				</span>
				<h1 className="text-3xl font-bold font-heading mt-4">
					{statusLabels[trade.status]}
				</h1>
				<p className="text-sm text-on-surface-variant mt-2">
					{statusMessages[trade.status]}
				</p>
				{trade.releaseTitle && (
					<p className="text-[10px] font-mono text-on-surface-variant mt-4">
						TRADE: {trade.releaseTitle}
						{trade.releaseArtist ? ` by ${trade.releaseArtist}` : ""}
					</p>
				)}
				<Link
					href="/trades"
					className="inline-block mt-8 px-6 py-2 bg-surface-container-high text-on-surface text-sm font-mono rounded hover:bg-surface-bright transition-colors"
				>
					BACK_TO_TRADES
				</Link>
			</div>
		);
	}

	// Handle pending status: provider can accept or decline
	if (trade.status === "pending" && role === "sender") {
		return (
			<div className="max-w-2xl mx-auto px-4 md:px-8 py-16 text-center">
				<span className="material-symbols-outlined text-secondary text-5xl">
					handshake
				</span>
				<h1 className="text-3xl font-bold font-heading mt-4">
					INCOMING_TRADE_REQUEST
				</h1>
				<p className="text-sm text-on-surface-variant mt-2">
					Someone wants to trade a file with you.
				</p>
				{trade.releaseTitle && (
					<p className="text-[10px] font-mono text-on-surface-variant mt-4">
						RELEASE: {trade.releaseTitle}
						{trade.releaseArtist ? ` by ${trade.releaseArtist}` : ""}
					</p>
				)}
				{trade.fileName && (
					<p className="text-[10px] font-mono text-on-surface-variant mt-1">
						FILE: {trade.fileName}
					</p>
				)}
				{trade.expiresAt && (
					<p className="text-[10px] font-mono text-on-surface-variant mt-1">
						<span className="material-symbols-outlined text-[10px] align-middle mr-1">schedule</span>
						{formatTimeRemaining(trade.expiresAt)}
					</p>
				)}
				{trade.message && (
					<div className="mt-4 bg-surface-container-low rounded-lg p-4 border border-outline-variant/10 text-left">
						<p className="text-[10px] font-mono text-on-surface-variant mb-1">
							MESSAGE:
						</p>
						<p className="text-sm text-on-surface">{trade.message}</p>
					</div>
				)}
				<div className="flex items-center justify-center gap-4 mt-8">
					<form
						action={async () => {
							"use server";
							await acceptTrade(id);
							redirect(`/trades/${id}`);
						}}
					>
						<button
							type="submit"
							className="px-6 py-2 bg-primary text-on-primary text-sm font-mono rounded hover:opacity-90 transition-opacity"
						>
							ACCEPT_TRADE
						</button>
					</form>
					<form
						action={async () => {
							"use server";
							await declineTrade(id);
							redirect(`/trades/${id}`);
						}}
					>
						<button
							type="submit"
							className="px-6 py-2 bg-surface-container-high text-on-surface text-sm font-mono rounded hover:bg-surface-bright transition-colors"
						>
							DECLINE_TRADE
						</button>
					</form>
				</div>
			</div>
		);
	}

	// Handle pending status for requester: waiting for provider to accept
	if (trade.status === "pending" && role === "receiver") {
		return (
			<div className="max-w-2xl mx-auto px-4 md:px-8 py-16 text-center">
				<span className="material-symbols-outlined text-tertiary text-5xl">
					hourglass_top
				</span>
				<h1 className="text-3xl font-bold font-heading mt-4">
					WAITING_FOR_ACCEPTANCE
				</h1>
				<p className="text-sm text-on-surface-variant mt-2">
					Waiting for @{trade.counterpartyUsername ?? "user"} to accept your
					trade request.
				</p>
				{trade.releaseTitle && (
					<p className="text-[10px] font-mono text-on-surface-variant mt-4">
						TRADE: {trade.releaseTitle}
						{trade.releaseArtist ? ` by ${trade.releaseArtist}` : ""}
					</p>
				)}
				{trade.expiresAt && (
					<p className="text-[10px] font-mono text-on-surface-variant mt-1">
						<span className="material-symbols-outlined text-[10px] align-middle mr-1">schedule</span>
						{formatTimeRemaining(trade.expiresAt)}
					</p>
				)}
				<Link
					href="/trades"
					className="inline-block mt-8 px-6 py-2 bg-surface-container-high text-on-surface text-sm font-mono rounded hover:bg-surface-bright transition-colors"
				>
					BACK_TO_TRADES
				</Link>
			</div>
		);
	}

	// Active trade: accepted or transferring — show the lobby
	const iceServers = await getTurnCredentials();

	// provider (sender) → counterparty is requester; requester (receiver) → counterparty is provider
	const counterpartyId =
		role === "sender" ? trade.requesterId : trade.providerId;

	return (
		<div className="max-w-2xl mx-auto px-4 md:px-8 py-16 text-center">
			<TradeLobby
				tradeId={trade.id}
				userId={user.id}
				counterpartyId={counterpartyId}
				role={role}
				iceServers={iceServers}
				counterpartyUsername={trade.counterpartyUsername ?? "user"}
				releaseTitle={trade.releaseTitle ?? "Unknown Release"}
				fileName={trade.fileName ?? "file"}
				fileSizeBytes={trade.fileSizeBytes ?? 0}
			/>
		</div>
	);
}
