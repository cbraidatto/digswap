"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useState } from "react";
import { createCounterproposalAction, createProposalAction } from "@/actions/trade-proposals";
import type { TradeableItem } from "@/lib/trades/proposal-queries";
import { CollectionColumn } from "./CollectionColumn";
import { QualityDeclarationModal } from "./QualityDeclarationModal";

interface BasketItem {
	item: TradeableItem;
	declaredQuality: string;
	conditionNotes?: string;
}

interface ProposalBuilderProps {
	myItems: TradeableItem[];
	theirItems: TradeableItem[];
	targetUserId: string;
	targetUsername: string;
	isPremium: boolean;
	currentUserId: string;
	tradeId?: string;
}

export function ProposalBuilder({
	myItems,
	theirItems,
	targetUserId,
	targetUsername,
	isPremium,
	tradeId,
}: ProposalBuilderProps) {
	const router = useRouter();
	const maxItems = isPremium ? 3 : 1;
	const isCounterMode = !!tradeId;

	// State
	const [pendingItem, setPendingItem] = useState<{
		item: TradeableItem;
		side: "offer" | "want";
	} | null>(null);
	const [offerBasket, setOfferBasket] = useState<BasketItem[]>([]);
	const [wantBasket, setWantBasket] = useState<BasketItem[]>([]);
	const [message, setMessage] = useState("");
	const [isSubmitting, setIsSubmitting] = useState(false);
	const [error, setError] = useState<string | null>(null);

	// Derived
	const offerIds = offerBasket.map((b) => b.item.id);
	const wantIds = wantBasket.map((b) => b.item.id);

	// Handlers
	const handleItemClick = useCallback(
		(item: TradeableItem, side: "offer" | "want") => {
			const basket = side === "offer" ? offerBasket : wantBasket;
			const setBasket = side === "offer" ? setOfferBasket : setWantBasket;

			// If already selected, remove from basket
			const existing = basket.find((b) => b.item.id === item.id);
			if (existing) {
				setBasket((prev) => prev.filter((b) => b.item.id !== item.id));
				return;
			}

			// Open quality declaration modal
			setPendingItem({ item, side });
		},
		[offerBasket, wantBasket],
	);

	const handleQualityConfirm = useCallback(
		(item: TradeableItem, quality: { declaredQuality: string; conditionNotes?: string }) => {
			if (!pendingItem) return;
			const { side } = pendingItem;

			const basketItem: BasketItem = {
				item,
				declaredQuality: quality.declaredQuality,
				conditionNotes: quality.conditionNotes,
			};

			if (side === "offer") {
				setOfferBasket((prev) => [...prev, basketItem]);
			} else {
				setWantBasket((prev) => [...prev, basketItem]);
			}
			setPendingItem(null);
		},
		[pendingItem],
	);

	const handleRemoveFromBasket = useCallback((itemId: string, side: "offer" | "want") => {
		if (side === "offer") {
			setOfferBasket((prev) => prev.filter((b) => b.item.id !== itemId));
		} else {
			setWantBasket((prev) => prev.filter((b) => b.item.id !== itemId));
		}
	}, []);

	const handleSubmit = useCallback(async () => {
		if (offerBasket.length === 0 || wantBasket.length === 0) return;

		setIsSubmitting(true);
		setError(null);

		try {
			const offerItems = offerBasket.map((b) => ({
				collectionItemId: b.item.id,
				releaseId: b.item.releaseId,
				declaredQuality: b.declaredQuality,
				conditionNotes: b.conditionNotes,
			}));
			const wantItems = wantBasket.map((b) => ({
				collectionItemId: b.item.id,
				releaseId: b.item.releaseId,
				declaredQuality: b.declaredQuality,
				conditionNotes: b.conditionNotes,
			}));

			if (isCounterMode && tradeId) {
				// Counter mode: use createCounterproposalAction
				const result = await createCounterproposalAction({
					tradeId,
					offerItems,
					wantItems,
					message: message.trim() || undefined,
				});

				if ("error" in result) {
					setError(result.error);
				} else {
					router.push(`/trades/${tradeId}`);
				}
			} else {
				// Normal mode: use createProposalAction
				const result = await createProposalAction({
					targetUserId,
					offerItems,
					wantItems,
					message: message.trim() || undefined,
				});

				if ("error" in result) {
					setError(result.error);
				} else {
					router.push(`/trades/${result.tradeId}`);
				}
			}
		} catch {
			setError("Something went wrong. Please try again.");
		} finally {
			setIsSubmitting(false);
		}
	}, [offerBasket, wantBasket, message, targetUserId, router, isCounterMode, tradeId]);

	const canSubmit = offerBasket.length > 0 && wantBasket.length > 0 && !isSubmitting;

	return (
		<div className="space-y-6">
			{/* Page header */}
			<div>
				<Link
					href={isCounterMode ? `/trades/${tradeId}` : "/trades"}
					className="text-xs text-muted-foreground hover:text-foreground transition-colors inline-flex items-center gap-1 mb-3"
				>
					<span className="material-symbols-outlined text-sm">arrow_back</span>
					{isCounterMode ? "Back to Trade" : "Back to Trades"}
				</Link>
				<h1 className="font-heading text-xl font-bold text-foreground">
					{isCounterMode ? (
						<>
							Counter Proposal{" "}
							<span className="text-muted-foreground text-base font-normal">with</span>{" "}
							<span className="text-primary">{targetUsername}</span>
						</>
					) : (
						<>
							New Trade with <span className="text-primary">{targetUsername}</span>
						</>
					)}
				</h1>
				<p className="text-muted-foreground text-xs mt-1">
					{isCounterMode
						? "Select records to offer and request in your counteroffer."
						: "Select records to offer and request, then submit your proposal."}
				</p>
			</div>

			{/* Two-column layout */}
			<div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
				<CollectionColumn
					title="Your Offers"
					items={myItems}
					selectedIds={offerIds}
					maxSelectable={maxItems}
					onSelect={(item) => handleItemClick(item, "offer")}
					side="offer"
				/>
				<CollectionColumn
					title="You Want"
					items={theirItems}
					selectedIds={wantIds}
					maxSelectable={maxItems}
					onSelect={(item) => handleItemClick(item, "want")}
					side="want"
				/>
			</div>

			{/* Proposal Summary */}
			<div className="border border-outline-variant rounded-xl p-4 bg-surface-container-lowest space-y-4">
				<h2 className="font-heading text-base font-bold text-foreground">
					{isCounterMode ? "Counteroffer Summary" : "Proposal Summary"}
				</h2>

				{/* Tier badge */}
				{!isPremium && (
					<div className="flex items-center gap-2 px-3 py-2 rounded bg-surface-container-high border border-outline-variant text-xs">
						<span className="material-symbols-outlined text-sm text-muted-foreground">info</span>
						<span className="text-muted-foreground">
							Free tier: 1 item per side.{" "}
							<Link href="/settings" className="text-primary hover:underline">
								Upgrade
							</Link>{" "}
							for 3:3 trades.
						</span>
					</div>
				)}

				{/* Offer list */}
				<div className="space-y-2">
					<h3 className="text-xs font-mono text-muted-foreground uppercase tracking-wider">
						Offering ({offerBasket.length})
					</h3>
					{offerBasket.length === 0 ? (
						<p className="text-xs text-muted-foreground/50 italic">No records selected yet</p>
					) : (
						<div className="space-y-1.5">
							{offerBasket.map((b) => (
								<BasketItemRow
									key={b.item.id}
									basketItem={b}
									onRemove={() => handleRemoveFromBasket(b.item.id, "offer")}
								/>
							))}
						</div>
					)}
				</div>

				{/* Want list */}
				<div className="space-y-2">
					<h3 className="text-xs font-mono text-muted-foreground uppercase tracking-wider">
						Requesting ({wantBasket.length})
					</h3>
					{wantBasket.length === 0 ? (
						<p className="text-xs text-muted-foreground/50 italic">No records selected yet</p>
					) : (
						<div className="space-y-1.5">
							{wantBasket.map((b) => (
								<BasketItemRow
									key={b.item.id}
									basketItem={b}
									onRemove={() => handleRemoveFromBasket(b.item.id, "want")}
								/>
							))}
						</div>
					)}
				</div>

				{/* Optional message */}
				<div className="space-y-2">
					<label className="text-xs font-mono text-muted-foreground uppercase tracking-wider">
						Message <span className="text-muted-foreground/40">(optional)</span>
					</label>
					<textarea
						value={message}
						onChange={(e) => setMessage(e.target.value.slice(0, 1000))}
						placeholder={
							isCounterMode
								? "Add a message to your counteroffer..."
								: "Add a message to your trade proposal..."
						}
						rows={2}
						maxLength={1000}
						className="w-full rounded border border-outline-variant bg-surface-container-lowest px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground/40 focus:outline-none focus:border-primary transition-colors resize-none"
					/>
				</div>

				{/* Error */}
				{error && (
					<div className="flex items-center gap-2 px-3 py-2 rounded bg-red-500/10 border border-red-500/20 text-xs text-red-400">
						<span className="material-symbols-outlined text-sm">error</span>
						{error}
					</div>
				)}

				{/* Submit */}
				<button
					type="button"
					onClick={handleSubmit}
					disabled={!canSubmit}
					className={`w-full py-2.5 rounded-lg font-heading font-bold text-sm transition-colors ${
						canSubmit
							? "bg-primary text-primary-foreground hover:bg-primary/90 cursor-pointer"
							: "bg-surface-container-high text-muted-foreground cursor-not-allowed"
					}`}
				>
					{isSubmitting ? (
						<span className="inline-flex items-center gap-2">
							<span className="material-symbols-outlined text-base animate-spin">
								progress_activity
							</span>
							Sending...
						</span>
					) : (
						<span className="inline-flex items-center gap-2">
							<span className="material-symbols-outlined text-base">send</span>
							{isCounterMode ? "Send Counteroffer" : "Send Proposal"}
						</span>
					)}
				</button>
			</div>

			{/* Quality Declaration Modal */}
			<QualityDeclarationModal
				item={pendingItem?.item ?? null}
				side={pendingItem?.side ?? "offer"}
				onConfirm={handleQualityConfirm}
				onClose={() => setPendingItem(null)}
			/>
		</div>
	);
}

// ---------------------------------------------------------------------------
// BasketItemRow -- inline sub-component for basket display
// ---------------------------------------------------------------------------

function BasketItemRow({ basketItem, onRemove }: { basketItem: BasketItem; onRemove: () => void }) {
	const { item, declaredQuality, conditionNotes } = basketItem;

	return (
		<div className="flex items-center gap-3 p-2 rounded bg-surface-container-high border border-outline-variant/50">
			{/* Cover */}
			<div className="relative w-8 h-8 flex-shrink-0 rounded overflow-hidden bg-surface-container-highest">
				{item.coverImageUrl ? (
					<Image
						src={item.coverImageUrl}
						alt=""
						fill
						sizes="32px"
						className="object-cover"
						unoptimized
					/>
				) : (
					<div className="absolute inset-0 flex items-center justify-center">
						<span className="material-symbols-outlined text-sm text-on-surface-variant/30">
							album
						</span>
					</div>
				)}
			</div>

			{/* Info */}
			<div className="min-w-0 flex-1">
				<p className="text-xs font-bold text-on-surface truncate">{item.title}</p>
				<p className="text-[10px] text-muted-foreground truncate">
					{item.artist} {"\u00b7"} <span className="font-mono">{declaredQuality}</span>
					{conditionNotes && (
						<span className="text-muted-foreground/50">
							{" "}
							{"\u2014"} {conditionNotes}
						</span>
					)}
				</p>
			</div>

			{/* Remove button */}
			<button
				type="button"
				onClick={onRemove}
				className="flex-shrink-0 p-1 rounded hover:bg-surface-container-highest transition-colors"
			>
				<span className="material-symbols-outlined text-base text-muted-foreground hover:text-red-400">
					close
				</span>
			</button>
		</div>
	);
}
