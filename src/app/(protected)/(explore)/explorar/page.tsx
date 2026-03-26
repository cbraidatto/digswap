"use client";

import { useState } from "react";
import { useSearchParams } from "next/navigation";
import { SearchSection } from "./_components/search-section";
import { RecordsTab } from "./_components/records-tab";

export default function ExplorarPage() {
	const searchParams = useSearchParams();
	const initialTab =
		searchParams.get("tab") === "records" ? "records" : "diggers";
	const [activeTab, setActiveTab] = useState<"diggers" | "records">(
		initialTab,
	);

	return (
		<div className="min-h-[calc(100vh-56px)] flex flex-col">
			{/* Tab Bar */}
			<div
				className="w-full border-b border-outline-variant/10"
				role="tablist"
			>
				<div className="max-w-4xl mx-auto flex gap-6">
					<button
						type="button"
						onClick={() => setActiveTab("diggers")}
						className={`px-4 py-2 font-mono text-[10px] uppercase tracking-widest transition-colors ${
							activeTab === "diggers"
								? "text-primary border-b-2 border-primary font-semibold"
								: "text-on-surface-variant hover:text-on-surface font-normal"
						}`}
						role="tab"
						aria-selected={activeTab === "diggers"}
					>
						DIGGERS
					</button>
					<button
						type="button"
						onClick={() => setActiveTab("records")}
						className={`px-4 py-2 font-mono text-[10px] uppercase tracking-widest transition-colors ${
							activeTab === "records"
								? "text-primary border-b-2 border-primary font-semibold"
								: "text-on-surface-variant hover:text-on-surface font-normal"
						}`}
						role="tab"
						aria-selected={activeTab === "records"}
					>
						RECORDS
					</button>
				</div>
			</div>

			{/* Tab Content */}
			{activeTab === "diggers" && (
				<section
					role="tabpanel"
					className="w-full bg-surface-container-low p-8 md:p-12"
				>
					<div className="max-w-4xl mx-auto">
						<SearchSection />
					</div>
				</section>
			)}

			{activeTab === "records" && (
				<section role="tabpanel">
					<RecordsTab />
				</section>
			)}
		</div>
	);
}
