"use client";

import { useState } from "react";
import Link from "next/link";
import type { RecordOwner } from "@/lib/discovery/queries";

interface OwnersListProps {
	owners: RecordOwner[];
}

export function OwnersList({ owners }: OwnersListProps) {
	const [expanded, setExpanded] = useState(false);

	if (!owners || owners.length === 0) {
		return (
			<div className="font-mono text-[10px] text-on-surface-variant py-2 pl-16">
				[NO_OWNERS_IN_NETWORK]
			</div>
		);
	}

	const visibleOwners = expanded ? owners : owners.slice(0, 3);
	const hiddenCount = owners.length - 3;

	return (
		<div className="pl-16 py-1 space-y-1">
			{visibleOwners.map((owner) => (
				<div
					key={owner.userId}
					className="flex items-center gap-2 h-8"
				>
					{/* Avatar */}
					<div className="w-6 h-6 rounded bg-surface-container-high flex items-center justify-center flex-shrink-0">
						{owner.avatarUrl ? (
							<img
								src={owner.avatarUrl}
								alt={owner.username || "user"}
								className="w-full h-full object-cover rounded"
							/>
						) : (
							<span className="text-[10px] font-mono font-bold text-primary">
								{(owner.username || "?").charAt(0).toUpperCase()}
							</span>
						)}
					</div>

					{/* Username */}
					{owner.username ? (
						<Link
							href={`/perfil/${owner.username}`}
							className="font-mono text-[10px] text-on-surface hover:text-primary transition-colors"
						>
							{owner.username}
						</Link>
					) : (
						<span className="font-mono text-[10px] text-on-surface-variant">
							unknown
						</span>
					)}

					{/* Condition Badge */}
					{owner.conditionGrade && (
						<span className="font-mono text-[10px] text-on-surface-variant border border-outline-variant/20 px-1 rounded">
							{owner.conditionGrade}
						</span>
					)}
				</div>
			))}

			{/* Expand Button */}
			{!expanded && hiddenCount > 0 && (
				<button
					type="button"
					onClick={() => setExpanded(true)}
					className="font-mono text-[10px] text-primary hover:underline"
				>
					+{hiddenCount} more
				</button>
			)}
		</div>
	);
}
