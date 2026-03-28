"use client";

import { useState } from "react";
import { RecordSearch } from "./record-search";
import { BrowseFilters } from "./browse-filters";
import { BrowseGrid } from "./browse-grid";
import { SuggestedSection } from "./suggested-section";

interface RecordsTabProps {
	p2pEnabled: boolean;
	currentUserId: string;
}

export function RecordsTab({ p2pEnabled, currentUserId }: RecordsTabProps) {
	const [selectedGenre, setSelectedGenre] = useState<string | null>(null);
	const [selectedDecade, setSelectedDecade] = useState<string | null>(null);

	return (
		<div className="w-full p-8 md:p-12">
			<div className="max-w-4xl mx-auto space-y-8">
				<RecordSearch p2pEnabled={p2pEnabled} currentUserId={currentUserId} />
				<div className="space-y-4">
					<BrowseFilters
						selectedGenre={selectedGenre}
						selectedDecade={selectedDecade}
						onGenreChange={setSelectedGenre}
						onDecadeChange={setSelectedDecade}
					/>
					<BrowseGrid genre={selectedGenre} decade={selectedDecade} />
				</div>
				<SuggestedSection />
			</div>
		</div>
	);
}
