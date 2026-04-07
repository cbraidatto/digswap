"use client";

import dynamic from "next/dynamic";
import { useState } from "react";

const AddRecordDialog = dynamic(
	() => import("./add-record-dialog").then((m) => m.AddRecordDialog),
	{
		ssr: false,
	},
);

export function AddRecordButton() {
	const [open, setOpen] = useState(false);

	return (
		<>
			<button
				type="button"
				onClick={() => setOpen(true)}
				className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-primary/10 border border-primary/20 text-primary hover:bg-primary/20 transition-colors font-mono text-xs uppercase tracking-widest"
			>
				<span className="material-symbols-outlined text-sm">add</span>
				Add Record
			</button>
			{open && <AddRecordDialog open={open} onOpenChange={setOpen} />}
		</>
	);
}
