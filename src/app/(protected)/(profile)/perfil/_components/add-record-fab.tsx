"use client";

import { useState } from "react";
import { AddRecordDialog } from "./add-record-dialog";

export function AddRecordFAB() {
	const [dialogOpen, setDialogOpen] = useState(false);

	return (
		<>
			<button
				type="button"
				onClick={() => setDialogOpen(true)}
				className="fixed bottom-[calc(64px+16px+env(safe-area-inset-bottom,0px))] right-4 z-40 lg:bottom-6 bg-primary text-on-primary w-14 h-14 rounded-full flex items-center justify-center shadow-lg shadow-primary/20 hover:scale-105 transition-transform"
				aria-label="Add record to collection"
			>
				<span className="material-symbols-outlined text-2xl">add</span>
			</button>
			<AddRecordDialog open={dialogOpen} onOpenChange={setDialogOpen} />
		</>
	);
}
