"use client";

import type { TradeableItem } from "@/lib/trades/proposal-queries";

interface ProposalBuilderProps {
	myItems: TradeableItem[];
	theirItems: TradeableItem[];
	targetUserId: string;
	targetUsername: string;
	isPremium: boolean;
	currentUserId: string;
}

// Placeholder - will be fully implemented in Task 2
export function ProposalBuilder({
	myItems,
	theirItems,
	targetUserId,
	targetUsername,
	isPremium,
	currentUserId,
}: ProposalBuilderProps) {
	return (
		<div>
			<p>ProposalBuilder placeholder</p>
		</div>
	);
}
