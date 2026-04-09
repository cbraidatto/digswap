"use client";

import { useState } from "react";
import { CreateCrateForm } from "./create-crate-form";

export function CratesHeader() {
	const [isCreating, setIsCreating] = useState(false);

	return (
		<div className="mb-8">
			<div className="flex items-center justify-between mb-2">
				<div>
					<div className="font-mono text-xs text-primary tracking-[0.15em] mb-1">[WORKSPACE]</div>
					<h1 className="font-heading text-2xl font-bold text-on-surface">Your Crates</h1>
				</div>
				{!isCreating && (
					<button
						type="button"
						onClick={() => setIsCreating(true)}
						className="font-mono text-xs px-3 py-1.5 rounded border border-primary/40 text-primary hover:bg-primary/10 transition-colors"
					>
						[+ NEW_CRATE]
					</button>
				)}
			</div>

			{isCreating && (
				<div className="mt-4">
					<CreateCrateForm
						onSuccess={() => setIsCreating(false)}
						onCancel={() => setIsCreating(false)}
					/>
				</div>
			)}
		</div>
	);
}
