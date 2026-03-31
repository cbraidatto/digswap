"use client";

import { useState } from "react";
import { AddRecordDialog } from "./add-record-dialog";

export function AddRecordButton() {
	const [open, setOpen] = useState(false);

	return (
		<>
			<button
				type="button"
				onClick={() => setOpen(true)}
				className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-primary/10 border border-primary/20 text-primary hover:bg-primary/20 transition-colors font-mono text-[10px] uppercase tracking-widest"
			>
				<span className="material-symbols-outlined text-sm">add</span>
				Add Record
			</button>
			<AddRecordDialog open={open} onOpenChange={setOpen} />
		</>
	);
}
