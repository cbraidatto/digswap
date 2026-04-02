"use client";

import dynamic from "next/dynamic";
import { useState } from "react";

const AddToWantlistDialog = dynamic(() => import("./add-to-wantlist-dialog").then(m => m.AddToWantlistDialog), {
	ssr: false,
});

export function WantlistAddButton() {
	const [open, setOpen] = useState(false);

	return (
		<>
			<button
				type="button"
				onClick={() => setOpen(true)}
				className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-secondary/10 border border-secondary/20 text-secondary hover:bg-secondary/20 transition-colors font-mono text-xs uppercase tracking-widest"
			>
				<span className="material-symbols-outlined text-sm">add</span>
				Add Record
			</button>
			{open && <AddToWantlistDialog open={open} onOpenChange={setOpen} />}
		</>
	);
}
