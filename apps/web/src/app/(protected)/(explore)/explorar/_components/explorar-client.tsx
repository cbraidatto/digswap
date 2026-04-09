"use client";

import { useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { RankingsTab } from "./rankings-tab";
import { RecordsTab } from "./records-tab";
import { SearchSection } from "./search-section";

type Tab = "diggers" | "records";

interface ExplorarClientProps {
	currentUserId: string | null;
}

export function ExplorarClient({ currentUserId }: ExplorarClientProps) {
	const searchParams = useSearchParams();
	const initialTab: Tab = searchParams.get("tab") === "records" ? "records" : "diggers";
	const [activeTab, setActiveTab] = useState<Tab>(initialTab);

	// Update URL when tab changes
	useEffect(() => {
		const url = activeTab === "diggers" ? "/explorar" : `/explorar?tab=${activeTab}`;
		window.history.replaceState(null, "", url);
	}, [activeTab]);

	return (
		<div className="min-h-[calc(100vh-56px)] flex flex-col">
			{/* Tab Bar */}
			<div className="w-full border-b border-outline-variant/10" role="tablist">
				<div className="px-6 flex gap-6">
					<button
						type="button"
						onClick={() => setActiveTab("diggers")}
						className={`px-4 py-2 font-mono text-xs uppercase tracking-widest transition-colors ${
							activeTab === "diggers"
								? "text-primary border-b-2 border-primary font-bold"
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
						className={`px-4 py-2 font-mono text-xs uppercase tracking-widest transition-colors ${
							activeTab === "records"
								? "text-primary border-b-2 border-primary font-bold"
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
				<section role="tabpanel" className="flex flex-col">
					{/* Search */}
					<div className="w-full bg-surface-container-low px-8 md:px-12 pt-8 pb-10">
						<div className="max-w-4xl mx-auto">
							<SearchSection />
						</div>
					</div>

					{/* Rankings */}
					<RankingsTab currentUserId={currentUserId ?? ""} />
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
