"use client";

import { useState } from "react";

interface UploadItem {
	proposalItemId: string;
	title: string;
	artist: string;
}

interface DesktopBridge {
	selectAndPrepareAudio(
		tradeId: string,
		proposalItemId: string,
	): Promise<{
		specs: { format: string; bitrate: number; sampleRate: number; duration: number };
		sha256: string;
		previewExpiresAt: string;
	}>;
}

function getDesktopBridge(): DesktopBridge | undefined {
	return (window as Window & { desktopBridge?: DesktopBridge }).desktopBridge;
}

type ItemState = "idle" | "uploading" | "done" | "error";

interface Props {
	tradeId: string;
	items: UploadItem[];
}

function formatDuration(s: number) {
	return `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, "0")}`;
}

function MusicIcon() {
	return (
		<svg
			width="16"
			height="16"
			viewBox="0 0 24 24"
			fill="none"
			stroke="currentColor"
			strokeWidth="1.5"
			strokeLinecap="round"
			strokeLinejoin="round"
		>
			<path d="M9 18V5l12-2v13" />
			<circle cx="6" cy="18" r="3" />
			<circle cx="18" cy="16" r="3" />
		</svg>
	);
}

function CheckIcon() {
	return (
		<svg
			width="14"
			height="14"
			viewBox="0 0 24 24"
			fill="none"
			stroke="currentColor"
			strokeWidth="2.5"
			strokeLinecap="round"
			strokeLinejoin="round"
		>
			<polyline points="20 6 9 17 4 12" />
		</svg>
	);
}

function UploadIcon() {
	return (
		<svg
			width="13"
			height="13"
			viewBox="0 0 24 24"
			fill="none"
			stroke="currentColor"
			strokeWidth="2"
			strokeLinecap="round"
			strokeLinejoin="round"
		>
			<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
			<polyline points="17 8 12 3 7 8" />
			<line x1="12" y1="3" x2="12" y2="15" />
		</svg>
	);
}

export function AudioUploadSection({ tradeId, items }: Props) {
	const [states, setStates] = useState<Record<string, ItemState>>({});
	const [errors, setErrors] = useState<Record<string, string>>({});
	const [specs, setSpecs] = useState<
		Record<
			string,
			{ format: string; bitrate: number; sampleRate: number; duration: number; sha256: string }
		>
	>({});

	const bridge = typeof window !== "undefined" ? getDesktopBridge() : undefined;

	if (!bridge) {
		return (
			<div className="rounded-lg border border-amber-400/20 bg-amber-400/5 p-5 flex items-start gap-4">
				<div className="w-9 h-9 rounded-full bg-amber-400/10 border border-amber-400/20 flex items-center justify-center flex-shrink-0 text-amber-400 mt-0.5">
					<MusicIcon />
				</div>
				<div className="flex flex-col gap-1">
					<p className="text-sm font-semibold text-amber-400">Open DigSwap Desktop to upload</p>
					<p className="text-xs text-muted-foreground leading-relaxed">
						Audio files must be uploaded from the desktop app. Open the trade there to continue.
					</p>
				</div>
			</div>
		);
	}

	async function handleUpload(item: UploadItem) {
		setStates((s) => ({ ...s, [item.proposalItemId]: "uploading" }));
		setErrors((e) => ({ ...e, [item.proposalItemId]: "" }));

		try {
			const result = await bridge!.selectAndPrepareAudio(tradeId, item.proposalItemId);
			setSpecs((s) => ({
				...s,
				[item.proposalItemId]: { ...result.specs, sha256: result.sha256 },
			}));
			setStates((s) => ({ ...s, [item.proposalItemId]: "done" }));
		} catch (err) {
			const msg = err instanceof Error ? err.message : "Upload failed";
			if (msg.toLowerCase().includes("cancel")) {
				setStates((s) => ({ ...s, [item.proposalItemId]: "idle" }));
				return;
			}
			setErrors((e) => ({ ...e, [item.proposalItemId]: msg }));
			setStates((s) => ({ ...s, [item.proposalItemId]: "error" }));
		}
	}

	const allDone = items.every((i) => states[i.proposalItemId] === "done");
	const doneCount = items.filter((i) => states[i.proposalItemId] === "done").length;

	return (
		<div className="rounded-lg border border-amber-400/25 overflow-hidden">
			{/* Header */}
			<div className="px-4 py-3 bg-amber-400/8 border-b border-amber-400/20 flex items-center justify-between gap-3">
				<div className="flex items-center gap-2.5">
					<span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse flex-shrink-0" />
					<span className="text-xs font-mono font-bold uppercase tracking-widest text-amber-400">
						Upload Your Audio Files
					</span>
				</div>
				{items.length > 1 && (
					<span className="text-xs font-mono text-amber-400/60">
						{doneCount}/{items.length}
					</span>
				)}
			</div>

			{/* Subtitle */}
			<div className="px-4 pt-3 pb-1">
				<p className="text-xs text-muted-foreground">
					A 2-minute preview will be generated and sent to your trade partner for approval before
					the full transfer.
				</p>
			</div>

			{/* Items */}
			<div className="px-4 pb-4 pt-2 flex flex-col gap-2">
				{items.map((item) => {
					const state = states[item.proposalItemId] ?? "idle";
					const error = errors[item.proposalItemId];
					const spec = specs[item.proposalItemId];

					return (
						<div
							key={item.proposalItemId}
							className={[
								"rounded border transition-colors",
								state === "done"
									? "border-green-500/25 bg-green-500/5"
									: state === "error"
										? "border-destructive/30 bg-destructive/5"
										: "border-outline-variant bg-surface-container-lowest",
							].join(" ")}
						>
							<div className="p-3 flex items-center justify-between gap-3">
								{/* Track info */}
								<div className="flex items-center gap-3 min-w-0">
									<div
										className={[
											"w-8 h-8 rounded flex items-center justify-center flex-shrink-0 transition-colors",
											state === "done"
												? "bg-green-500/15 text-green-500"
												: "bg-surface-container text-muted-foreground",
										].join(" ")}
									>
										{state === "done" ? <CheckIcon /> : <MusicIcon />}
									</div>
									<div className="min-w-0">
										<p className="text-sm font-medium text-foreground truncate leading-snug">
											{item.title}
										</p>
										<p className="text-xs text-muted-foreground truncate">{item.artist}</p>
									</div>
								</div>

								{/* Action */}
								{state === "done" ? (
									<span className="text-xs text-green-500 font-mono font-medium flex-shrink-0 flex items-center gap-1.5">
										<CheckIcon />
										Uploaded
									</span>
								) : (
									<button
										type="button"
										disabled={state === "uploading"}
										onClick={() => handleUpload(item)}
										className={[
											"flex-shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-mono font-bold transition-all",
											state === "uploading"
												? "bg-surface-container text-muted-foreground cursor-not-allowed"
												: state === "error"
													? "bg-destructive/15 border border-destructive/40 text-destructive hover:bg-destructive/25"
													: "bg-amber-400/12 border border-amber-400/40 text-amber-400 hover:bg-amber-400/20 hover:border-amber-400/60",
										].join(" ")}
									>
										{state === "uploading" ? (
											<>
												<span className="w-3 h-3 rounded-full border border-current border-t-transparent animate-spin" />
												Processing…
											</>
										) : state === "error" ? (
											<>
												<span>↺</span>
												Retry
											</>
										) : (
											<>
												<UploadIcon />
												Select File
											</>
										)}
									</button>
								)}
							</div>

							{/* Specs row */}
							{spec && (
								<div className="px-3 pb-2.5 flex items-center gap-2 flex-wrap">
									<span className="text-[10px] font-mono text-muted-foreground/70 bg-surface-container px-1.5 py-0.5 rounded">
										{spec.format.toUpperCase()}
									</span>
									<span className="text-[10px] font-mono text-muted-foreground/70">
										{spec.bitrate} kbps
									</span>
									<span className="text-[10px] font-mono text-muted-foreground/70">
										{(spec.sampleRate / 1000).toFixed(1)} kHz
									</span>
									<span className="text-[10px] font-mono text-muted-foreground/70">
										{formatDuration(spec.duration)}
									</span>
									<span className="text-[10px] font-mono text-muted-foreground/40 ml-auto">
										{spec.sha256.slice(0, 12)}…
									</span>
								</div>
							)}

							{/* Error */}
							{error && <p className="px-3 pb-2.5 text-xs text-destructive">{error}</p>}
						</div>
					);
				})}
			</div>

			{/* All done banner */}
			{allDone && (
				<div className="mx-4 mb-4 rounded border border-green-500/25 bg-green-500/8 px-3 py-2.5 flex items-center gap-2">
					<span className="w-1.5 h-1.5 rounded-full bg-green-500 flex-shrink-0" />
					<p className="text-xs text-green-500 font-mono">
						All files uploaded — waiting for your trade partner to upload theirs.
					</p>
				</div>
			)}
		</div>
	);
}
