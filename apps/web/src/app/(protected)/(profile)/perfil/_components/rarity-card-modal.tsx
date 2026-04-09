"use client";

import Image from "next/image";
import { useState } from "react";
import { ShareSurface } from "@/components/share/share-surface";
import {
	Dialog,
	DialogContent,
	DialogHeader,
	DialogTitle,
	DialogTrigger,
} from "@/components/ui/dialog";

interface RarityCardModalProps {
	username: string;
	appUrl: string;
	displayName?: string;
	totalRecords?: number;
	gemScore?: number;
	avgRarity?: number;
	ogSig?: string;
}

export function RarityCardModal({
	username,
	appUrl,
	displayName,
	totalRecords = 0,
	gemScore = 0,
	avgRarity = 0,
	ogSig,
}: RarityCardModalProps) {
	const [open, setOpen] = useState(false);
	const params = new URLSearchParams({
		name: displayName ?? username,
		total: String(totalRecords),
		gems: String(gemScore),
		avg: String(avgRarity),
		...(ogSig ? { sig: ogSig } : {}),
	});
	const cardUrl = `${appUrl}/api/og/rarity/${username}?${params.toString()}`;

	return (
		<Dialog open={open} onOpenChange={setOpen}>
			<DialogTrigger className="font-mono text-xs text-on-surface-variant hover:text-primary transition-colors">
				GENERATE_GEM_CARD
			</DialogTrigger>
			<DialogContent className="bg-surface-container border-outline-variant/20 sm:max-w-2xl">
				<DialogHeader>
					<DialogTitle className="font-mono text-xs text-primary tracking-[0.15em]">
						[GEM_SCORE_CARD]
					</DialogTitle>
				</DialogHeader>
				<div className="space-y-4">
					{/* eslint-disable-next-line @next/next/no-img-element */}
					<Image
						src={cardUrl}
						alt="Gem Score Card"
						width={1200}
						height={630}
						unoptimized
						className="w-full rounded"
						style={{ aspectRatio: "1200/630" }}
					/>
					<ShareSurface url={cardUrl} label="SHARE_GEM_CARD" />
				</div>
			</DialogContent>
		</Dialog>
	);
}
