"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { exportCollectionCsv } from "@/actions/export";

export function ExportCollectionButton() {
	const [isPending, startTransition] = useTransition();

	function handleExport() {
		startTransition(async () => {
			const result = await exportCollectionCsv();
			if (result.error) {
				toast.error(result.error);
				return;
			}
			if (!result.csv) return;

			// Create download
			const blob = new Blob([result.csv], { type: "text/csv;charset=utf-8;" });
			const url = URL.createObjectURL(blob);
			const link = document.createElement("a");
			link.href = url;
			link.download = `digswap-collection-${new Date().toISOString().split("T")[0]}.csv`;
			link.click();
			URL.revokeObjectURL(url);
			toast.success("Collection exported");
		});
	}

	return (
		<button
			type="button"
			onClick={handleExport}
			disabled={isPending}
			title="Export collection as CSV"
			className="p-2 rounded text-on-surface-variant hover:text-primary hover:bg-surface-container-high transition-colors disabled:opacity-50"
		>
			<span className="material-symbols-outlined text-lg">
				{isPending ? "hourglass_top" : "download"}
			</span>
		</button>
	);
}
