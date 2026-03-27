"use client";

import { useState, useTransition } from "react";
import {
	Dialog,
	DialogContent,
	DialogTitle,
} from "@/components/ui/dialog";
import { acceptToS } from "@/actions/trades";

interface ToSModalProps {
	tosAccepted: boolean;
}

export function ToSModal({ tosAccepted }: ToSModalProps) {
	const [open, setOpen] = useState(!tosAccepted);
	const [checked, setChecked] = useState(false);
	const [isPending, startTransition] = useTransition();

	function handleAccept() {
		startTransition(async () => {
			const result = await acceptToS();
			if (result.success) {
				setOpen(false);
			}
		});
	}

	if (tosAccepted) return null;

	return (
		<Dialog
			open={open}
			onOpenChange={(nextOpen) => {
				// Cannot dismiss without acceptance
				if (!nextOpen) return;
			}}
		>
			<DialogContent
				className="max-w-lg mx-auto bg-surface-container-low rounded-xl border border-outline-variant/10 p-8 sm:max-w-lg"
				showCloseButton={false}
				role="alertdialog"
				aria-modal="true"
			>
				<div className="flex flex-col gap-6">
					<div>
						<span className="material-symbols-outlined text-primary text-4xl block mb-4">
							gavel
						</span>
						<DialogTitle className="text-2xl font-bold font-heading uppercase">
							TERMS_OF_SERVICE
						</DialogTitle>
					</div>

					<div className="text-sm font-sans text-on-surface-variant space-y-3">
						<p>By proceeding, you acknowledge that:</p>
						<ul className="space-y-2">
							<li>
								- You own the copyright to or have the legal right to share any
								files you transfer.
							</li>
							<li>
								- You assume full responsibility for the content of files shared
								through this platform.
							</li>
							<li>
								- DigSwap acts as a mere conduit -- no file data is stored on or
								passes through our servers.
							</li>
						</ul>
					</div>

					<label
						className="font-mono text-xs flex items-center gap-2 cursor-pointer select-none"
						htmlFor="tos-checkbox"
					>
						<input
							id="tos-checkbox"
							type="checkbox"
							checked={checked}
							onChange={(e) => setChecked(e.target.checked)}
							className="h-4 w-4 rounded border-outline-variant accent-primary"
						/>
						I accept the Terms of Service
					</label>

					<button
						type="button"
						disabled={!checked || isPending}
						onClick={handleAccept}
						className="w-full py-3 rounded-lg bg-primary-container text-on-primary-container font-mono text-xs font-bold uppercase tracking-widest transition-all disabled:opacity-40 disabled:cursor-not-allowed hover:opacity-90"
					>
						{isPending ? "PROCESSING..." : "ACCEPT_AND_CONTINUE"}
					</button>
				</div>
			</DialogContent>
		</Dialog>
	);
}
