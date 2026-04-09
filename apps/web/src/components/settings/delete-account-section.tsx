"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { deleteAccountAction } from "@/actions/account";

export function DeleteAccountSection() {
	const router = useRouter();
	const [showForm, setShowForm] = useState(false);
	const [confirmation, setConfirmation] = useState("");
	const [isPending, startTransition] = useTransition();
	const [error, setError] = useState<string | null>(null);

	function handleDelete() {
		setError(null);
		startTransition(async () => {
			const formData = new FormData();
			formData.set("confirmation", confirmation);
			const result = await deleteAccountAction(formData);
			if (!result.success) {
				setError(result.error ?? "Failed to delete account.");
				return;
			}
			router.push("/signin");
		});
	}

	return (
		<div className="border border-destructive/20 rounded p-4 bg-destructive/5">
			<h3 className="font-mono text-xs text-destructive uppercase tracking-widest mb-2">
				Danger Zone
			</h3>
			<p className="font-mono text-xs text-on-surface-variant mb-3">
				Permanently delete your account and all associated data. This action cannot be undone.
			</p>

			{!showForm ? (
				<button
					type="button"
					onClick={() => setShowForm(true)}
					className="font-mono text-xs text-destructive border border-destructive/30 px-3 py-1.5 rounded hover:bg-destructive/10 transition-colors"
				>
					Delete my account
				</button>
			) : (
				<div className="space-y-3">
					<div>
						<label
							htmlFor="delete-account-confirmation"
							className="font-mono text-[10px] text-on-surface-variant uppercase tracking-widest block mb-1"
						>
							Type DELETE MY ACCOUNT to confirm
						</label>
						<input
							id="delete-account-confirmation"
							type="text"
							value={confirmation}
							onChange={(e) => setConfirmation(e.target.value)}
							placeholder="DELETE MY ACCOUNT"
							className="w-full bg-surface-container-lowest border border-outline-variant/20 rounded px-3 py-2 font-mono text-xs text-on-surface placeholder:text-on-surface-variant/30 focus:outline-none focus:border-destructive/50"
						/>
					</div>

					{error && <p className="font-mono text-xs text-destructive">{error}</p>}

					<div className="flex items-center gap-2">
						<button
							type="button"
							onClick={handleDelete}
							disabled={isPending || confirmation !== "DELETE MY ACCOUNT"}
							className="font-mono text-xs font-bold bg-destructive text-background px-4 py-2 rounded disabled:opacity-30 hover:opacity-90 transition-opacity"
						>
							{isPending ? "Deleting..." : "Permanently delete"}
						</button>
						<button
							type="button"
							onClick={() => {
								setShowForm(false);
								setConfirmation("");
								setError(null);
							}}
							className="font-mono text-xs text-on-surface-variant hover:text-on-surface px-3 py-2 transition-colors"
						>
							Cancel
						</button>
					</div>
				</div>
			)}
		</div>
	);
}
