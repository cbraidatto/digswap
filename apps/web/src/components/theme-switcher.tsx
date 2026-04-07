"use client";

import { useState } from "react";
import { THEMES, useAppTheme } from "./theme-provider";

export function ThemeSwitcher() {
	const { theme, setTheme } = useAppTheme();
	const [open, setOpen] = useState(false);

	return (
		<div className="relative">
			<button
				type="button"
				onClick={() => setOpen((o) => !o)}
				title="Change theme"
				className="w-6 h-6 rounded-full border-2 border-outline/30 hover:border-primary/60 transition-colors overflow-hidden flex-shrink-0"
				style={{ background: THEMES.find((t) => t.id === theme)?.primary }}
			/>

			{open && (
				<>
					<div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
					<div className="absolute right-0 top-8 z-50 bg-surface-container border border-outline/20 rounded-lg p-3 flex flex-col gap-2 min-w-[160px] shadow-xl">
						<p className="font-mono text-[9px] uppercase tracking-[0.2em] text-outline mb-1">
							Theme
						</p>
						{THEMES.map((t) => (
							<button
								key={t.id}
								type="button"
								onClick={() => {
									setTheme(t.id);
									setOpen(false);
								}}
								className={`flex items-center gap-2.5 px-2 py-1.5 rounded transition-colors hover:bg-surface-container-high text-left ${
									theme === t.id ? "bg-surface-container-high" : ""
								}`}
							>
								<span
									className="w-4 h-4 rounded-full flex-shrink-0 border border-white/10"
									style={{ background: t.primary }}
								/>
								<span className="font-mono text-xs text-on-surface-variant whitespace-nowrap">
									{t.name}
								</span>
								{theme === t.id && (
									<span className="material-symbols-outlined text-[12px] text-primary ml-auto">
										check
									</span>
								)}
							</button>
						))}
					</div>
				</>
			)}
		</div>
	);
}
