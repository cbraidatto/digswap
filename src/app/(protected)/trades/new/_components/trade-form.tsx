"use client";

import { useState, useMemo, useTransition, useCallback } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { createTrade } from "@/actions/trades";

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface TradeFormProps {
	toUserId: string | null;
	releaseId: string | null;
	counterpartyUsername: string | null;
	counterpartyAvatar: string | null;
	releaseTitle: string | null;
	releaseArtist: string | null;
	userCollection: Array<{
		releaseId: string;
		title: string;
		artist: string;
		thumbnailUrl: string | null;
	}>;
}

// ---------------------------------------------------------------------------
// Quality options
// ---------------------------------------------------------------------------

const QUALITY_OPTIONS = [
	{ value: "", label: "Select quality..." },
	{ value: "FLAC", label: "FLAC" },
	{ value: "MP3 320kbps", label: "MP3 320kbps" },
	{ value: "MP3 V0", label: "MP3 V0" },
	{ value: "MP3 192kbps", label: "MP3 192kbps" },
	{ value: "WAV", label: "WAV" },
	{ value: "Other", label: "Other" },
] as const;

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function TradeForm({
	toUserId,
	releaseId,
	counterpartyUsername,
	counterpartyAvatar,
	releaseTitle,
	releaseArtist,
	userCollection,
}: TradeFormProps) {
	const router = useRouter();
	const [isPending, startTransition] = useTransition();

	// New proposal fields (D-02, D-05)
	const [offeringReleaseId, setOfferingReleaseId] = useState<string>("");
	const [declaredQuality, setDeclaredQuality] = useState<string>("");
	const [conditionNotes, setConditionNotes] = useState<string>("");
	const [collectionSearch, setCollectionSearch] = useState<string>("");

	// Message
	const [message, setMessage] = useState("");

	// -----------------------------------------------------------------------
	// Collection filtering
	// -----------------------------------------------------------------------

	const filteredCollection = useMemo(() => {
		if (!collectionSearch.trim()) return userCollection;
		const query = collectionSearch.toLowerCase();
		return userCollection.filter(
			(item) =>
				item.title.toLowerCase().includes(query) ||
				item.artist.toLowerCase().includes(query),
		);
	}, [userCollection, collectionSearch]);

	// -----------------------------------------------------------------------
	// Submit
	// -----------------------------------------------------------------------

	const canSubmit =
		!!toUserId &&
		!!offeringReleaseId &&
		conditionNotes.trim().length >= 10 &&
		!!declaredQuality &&
		!isPending;

	const handleSubmit = useCallback(() => {
		if (!toUserId || !offeringReleaseId) return;

		startTransition(async () => {
			const result = await createTrade({
				providerId: toUserId,
				releaseId: releaseId || undefined,
				offeringReleaseId,
				declaredQuality,
				conditionNotes,
				message: message || undefined,
			});

			if (result.error) {
				toast.error(result.error);
				return;
			}

			toast.success("Trade request sent");
			router.push("/trades");
		});
	}, [toUserId, releaseId, offeringReleaseId, declaredQuality, conditionNotes, message, router]);

	// -----------------------------------------------------------------------
	// Render
	// -----------------------------------------------------------------------

	return (
		<>
			{/* Two-column grid */}
			<div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
				{/* Your_Offer card — offering release picker */}
				<div className="bg-surface-container-low rounded-xl p-6 border border-outline-variant/10">
					<h2 className="text-xs font-mono uppercase tracking-widest text-on-surface-variant mb-4">
						Your_Offer
					</h2>

					{userCollection.length === 0 ? (
						<div className="bg-surface-container-lowest rounded-lg p-8 flex flex-col items-center justify-center gap-3 border border-outline-variant/10 text-center">
							<span className="material-symbols-outlined text-on-surface-variant/40 text-3xl">
								library_music
							</span>
							<div className="text-xs font-mono text-on-surface-variant">
								NO_COLLECTION_FOUND
							</div>
							<p className="text-[10px] font-mono text-on-surface-variant/60 max-w-[200px]">
								Import your collection from Discogs first to make trade offers.
							</p>
						</div>
					) : (
						<>
							{/* Selected record chip */}
							{offeringReleaseId && (() => {
								const sel = userCollection.find(i => i.releaseId === offeringReleaseId);
								return sel ? (
									<div className="flex items-center gap-2 bg-primary/10 border border-primary/30 rounded-lg px-3 py-2 mb-3">
										{sel.thumbnailUrl ? (
											<img src={sel.thumbnailUrl} alt={sel.title} className="w-8 h-8 rounded object-cover flex-shrink-0" />
										) : (
											<span className="material-symbols-outlined text-primary text-base flex-shrink-0">album</span>
										)}
										<div className="min-w-0 flex-1">
											<div className="text-xs font-mono text-primary font-bold truncate">{sel.title}</div>
											<div className="text-[10px] font-mono text-on-surface-variant truncate">{sel.artist}</div>
										</div>
										<button
											type="button"
											onClick={() => setOfferingReleaseId("")}
											className="flex-shrink-0 text-on-surface-variant hover:text-on-surface transition-colors ml-1"
											aria-label="Clear selection"
										>
											<span className="material-symbols-outlined text-base">close</span>
										</button>
									</div>
								) : null;
							})()}

							{/* Search input */}
							<input
								type="text"
								value={collectionSearch}
								onChange={(e) => setCollectionSearch(e.target.value)}
								placeholder="Search your collection..."
								className="w-full bg-surface-container-lowest border border-outline-variant/20 rounded px-3 py-2 text-xs font-mono text-on-surface placeholder:text-on-surface-variant/40 focus:border-primary/40 focus:outline-none mb-2"
							/>

							{/* Scrollable collection list */}
							<div className="max-h-[260px] overflow-y-auto space-y-0.5 pr-1">
								{filteredCollection.length === 0 ? (
									<div className="text-[10px] font-mono text-on-surface-variant/60 text-center py-4">
										No releases match your search
									</div>
								) : (
									filteredCollection.map((item) => (
										<button
											key={item.releaseId}
											type="button"
											onClick={() => setOfferingReleaseId(item.releaseId)}
											className={`w-full flex items-center gap-3 rounded-lg p-2 transition-all text-left ${
												offeringReleaseId === item.releaseId
													? "bg-primary/10 border border-primary/30"
													: "hover:bg-surface-container-lowest/60 border border-transparent"
											}`}
										>
											{item.thumbnailUrl ? (
												<img
													src={item.thumbnailUrl}
													alt={item.title}
													className="w-9 h-9 rounded object-cover flex-shrink-0"
												/>
											) : (
												<div className="w-9 h-9 rounded bg-surface-container-high flex items-center justify-center flex-shrink-0">
													<span className="material-symbols-outlined text-on-surface-variant/40 text-sm">
														album
													</span>
												</div>
											)}
											<div className="min-w-0 flex-1">
												<div className="text-xs font-mono text-on-surface font-bold truncate">
													{item.title}
												</div>
												<div className="text-[10px] font-mono text-on-surface-variant truncate">
													{item.artist}
												</div>
											</div>
											{offeringReleaseId === item.releaseId && (
												<span className="material-symbols-outlined text-primary text-base flex-shrink-0">check_circle</span>
											)}
										</button>
									))
								)}
							</div>
						</>
					)}
				</div>

				{/* Request_From card */}
				<div className="bg-surface-container-low rounded-xl p-6 border border-outline-variant/10">
					<h2 className="text-xs font-mono uppercase tracking-widest text-on-surface-variant mb-4">
						Request_From
					</h2>

					{toUserId ? (
						<div className="bg-surface-container-lowest rounded-lg p-4 border-l-4 border-primary/20">
							<div className="flex items-center gap-3 mb-3">
								{counterpartyAvatar ? (
									<img
										src={counterpartyAvatar}
										alt={counterpartyUsername || "user"}
										className="w-8 h-8 rounded object-cover"
									/>
								) : (
									<div className="w-8 h-8 rounded bg-surface-container-high flex items-center justify-center">
										<span className="text-xs font-mono font-bold text-primary">
											{(counterpartyUsername || "?")
												.charAt(0)
												.toUpperCase()}
										</span>
									</div>
								)}
								<div className="text-xs font-mono text-on-surface font-bold">
									{counterpartyUsername || "Unknown user"}
								</div>
							</div>
							<div className="text-xs font-mono text-on-surface-variant">
								TARGET_USER:{" "}
								<span className="text-primary">
									{counterpartyUsername || toUserId.substring(0, 8)}
								</span>
							</div>
							{releaseTitle && (
								<div className="text-xs font-mono text-on-surface-variant mt-1">
									REQUESTED_ITEM:{" "}
									<span className="text-secondary">
										{releaseTitle}
										{releaseArtist && ` by ${releaseArtist}`}
									</span>
								</div>
							)}
						</div>
					) : (
						<div className="bg-surface-container-lowest rounded-lg p-8 flex flex-col items-center justify-center gap-3 border border-outline-variant/10 text-center">
							<span className="material-symbols-outlined text-on-surface-variant/40 text-3xl">
								person_search
							</span>
							<div className="text-xs font-mono text-on-surface-variant">
								NO_RECIPIENT_SELECTED
							</div>
							<p className="text-[10px] font-mono text-on-surface-variant/60 max-w-[200px]">
								Navigate from a user profile or explorar to pre-fill recipient
							</p>
						</div>
					)}
				</div>
			</div>

			{/* Quality metadata section */}
			<div className="bg-surface-container-low rounded-xl p-6 border border-outline-variant/10 mb-8">
				<h2 className="text-[10px] font-mono text-on-surface-variant tracking-[0.2em] uppercase mb-4">
					DECLARED_QUALITY
				</h2>

				<div className="space-y-4">
					{/* Quality format dropdown */}
					<div>
						<select
							value={declaredQuality}
							onChange={(e) => setDeclaredQuality(e.target.value)}
							className="w-full bg-surface-container-lowest border border-outline-variant/20 rounded px-3 py-2 font-mono text-xs text-on-surface focus:border-primary/40 focus:outline-none appearance-none cursor-pointer"
						>
							{QUALITY_OPTIONS.map((opt) => (
								<option key={opt.value} value={opt.value}>
									{opt.label}
								</option>
							))}
						</select>
					</div>
				</div>
			</div>

			{/* Condition notes section */}
			<div className="bg-surface-container-low rounded-xl p-6 border border-outline-variant/10 mb-8">
				<h2 className="text-[10px] font-mono text-on-surface-variant tracking-[0.2em] uppercase mb-4">
					CONDITION_NOTES
				</h2>

				<textarea
					value={conditionNotes}
					onChange={(e) => setConditionNotes(e.target.value)}
					placeholder="Describe the pressing, condition, any known artifacts... (min 10 chars)"
					rows={3}
					className="w-full bg-surface-container-lowest border border-outline-variant/20 rounded px-3 py-2 font-mono text-xs text-on-surface placeholder:text-on-surface-variant/40 focus:border-primary/40 focus:outline-none resize-none"
				/>
				<div className="mt-1 text-right">
					<span
						className={`text-[10px] font-mono ${
							conditionNotes.length > 0 && conditionNotes.trim().length < 10
								? "text-red-400"
								: "text-on-surface-variant/60"
						}`}
					>
						{conditionNotes.trim().length}/10 minimum
					</span>
				</div>
			</div>

			{/* Review_Window */}
			<div className="bg-surface-container-low rounded-xl p-6 border border-outline-variant/10 mb-8">
				<h2 className="text-xs font-mono uppercase tracking-widest text-on-surface-variant mb-4">
					Review_Window
				</h2>
				<div className="flex items-center gap-3">
					<span className="material-symbols-outlined text-on-surface-variant text-xl">
						schedule
					</span>
					<div>
						<div className="text-xs font-mono text-on-surface font-bold">24h FIXED WINDOW</div>
						<div className="text-[10px] font-mono text-on-surface-variant">
							Trade requests expire automatically after 24 hours
						</div>
					</div>
				</div>
			</div>

			{/* Optional message */}
			<div className="bg-surface-container-low rounded-xl p-6 border border-outline-variant/10 mb-8">
				<h2 className="text-xs font-mono uppercase tracking-widest text-on-surface-variant mb-4">
					Message (optional)
				</h2>
				<textarea
					value={message}
					onChange={(e) => setMessage(e.target.value)}
					placeholder="Add a note to the trade request..."
					rows={3}
					className="w-full bg-surface-container-lowest border border-outline-variant/20 rounded px-3 py-2 font-mono text-xs text-on-surface placeholder:text-on-surface-variant/40 focus:border-primary/40 focus:outline-none resize-none"
				/>
			</div>

			{/* Send button */}
			<button
				type="button"
				disabled={!canSubmit}
				onClick={handleSubmit}
				className="w-full bg-primary-container text-on-primary-container py-3 font-mono text-sm font-bold rounded transition-all disabled:opacity-40 disabled:cursor-not-allowed hover:opacity-90"
			>
				{isPending ? "SENDING..." : "SEND_TRADE_REQUEST"}
			</button>
		</>
	);
}
