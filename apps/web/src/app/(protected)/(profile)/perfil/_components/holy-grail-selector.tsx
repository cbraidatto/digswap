"use client";

import { useState } from "react";
import { updateHolyGrails } from "@/actions/profile";

interface HolyGrailSelectorProps {
	wantlistItems: Array<{
		id: string;
		releaseTitle: string | null;
		releaseArtist: string | null;
	}>;
	currentHolyGrailIds: string[];
}

export function HolyGrailSelector({ wantlistItems, currentHolyGrailIds }: HolyGrailSelectorProps) {
	const [selected, setSelected] = useState<string[]>(currentHolyGrailIds);
	const [saving, setSaving] = useState(false);

	const toggle = (id: string) => {
		setSelected((prev) =>
			prev.includes(id) ? prev.filter((x) => x !== id) : prev.length < 3 ? [...prev, id] : prev,
		);
	};

	const handleSave = async () => {
		setSaving(true);
		await updateHolyGrails(selected);
		setSaving(false);
	};

	return (
		<div className="space-y-2">
			<div className="font-mono text-xs text-on-surface-variant tracking-[0.15em]">
				{"[HOLY_GRAILS] // Select up to 3 records from your wantlist"}
			</div>
			{wantlistItems.length === 0 ? (
				<p className="font-mono text-xs text-outline/60">Add items to your wantlist first.</p>
			) : (
				<div className="space-y-1 max-h-48 overflow-y-auto">
					{wantlistItems.map((item) => (
						<label
							key={item.id}
							className={`flex items-center gap-2 p-2 rounded cursor-pointer transition-colors ${
								selected.includes(item.id)
									? "bg-primary/10 border border-primary/30"
									: "hover:bg-surface-container-high border border-transparent"
							}`}
						>
							<input
								type="checkbox"
								checked={selected.includes(item.id)}
								onChange={() => toggle(item.id)}
								className="accent-primary"
							/>
							<span className="font-mono text-xs text-on-surface truncate flex-1">
								{item.releaseTitle ?? "Unknown"}{" "}
								{item.releaseArtist ? `- ${item.releaseArtist}` : ""}
							</span>
							{selected.includes(item.id) && (
								<span className="ml-auto font-mono text-[9px] text-tertiary flex-shrink-0">
									[HOLY_GRAIL]
								</span>
							)}
						</label>
					))}
				</div>
			)}
			<button
				type="button"
				onClick={handleSave}
				disabled={saving}
				className="font-mono text-xs text-primary hover:underline disabled:opacity-50"
			>
				{saving ? "SAVING..." : "SAVE_SELECTION"}
			</button>
		</div>
	);
}
