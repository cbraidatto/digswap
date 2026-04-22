"use client";

import { useCallback, useEffect, useRef, useState } from "react";

interface ScanProgressEvent {
	filesFound: number;
	filesProcessed: number;
	currentPath: string;
}

interface ScanResult {
	totalFiles: number;
	newFiles: number;
	updatedFiles: number;
	removedFiles: number;
	skippedFiles: Array<{ path: string; reason: string }>;
}

interface LibraryTrack {
	id: string;
	filePath: string;
	artist: string | null;
	album: string | null;
	title: string | null;
	year: number | null;
	trackNumber: number | null;
	format: string;
	bitrate: number;
	sampleRate: number;
	bitDepth: number | null;
	duration: number;
	fileSize: number;
	artistConfidence: "high" | "low";
	albumConfidence: "high" | "low";
	titleConfidence: "high" | "low";
}

interface DesktopBridgeLibrary {
	selectLibraryFolder(): Promise<string | null>;
	startScan(folderPath: string): Promise<ScanResult>;
	startIncrementalScan(): Promise<ScanResult>;
	startFullScan(): Promise<ScanResult>;
	getLibraryTracks(): Promise<LibraryTrack[]>;
	getLibraryRoot(): Promise<string | null>;
	onScanProgress(listener: (event: ScanProgressEvent) => void): () => void;
}

type ScreenState = "loading" | "not-desktop" | "empty" | "scanning" | "error-summary" | "library";
type ViewMode = "list" | "album";

function formatDuration(seconds: number): string {
	const m = Math.floor(seconds / 60);
	const s = Math.floor(seconds % 60);
	return `${m}:${s.toString().padStart(2, "0")}`;
}

function formatBitrate(bps: number): string {
	return `${Math.round(bps / 1000)}k`;
}

function InferredText({ value, confidence }: { value: string | null; confidence: "high" | "low" }) {
	if (!value) return <span className="text-on-surface-variant/40">—</span>;
	return (
		<span className={confidence === "low" ? "italic text-on-surface-variant/60" : ""}>{value}</span>
	);
}

export default function BibliotecaPage() {
	const [state, setState] = useState<ScreenState>("loading");
	const [tracks, setTracks] = useState<LibraryTrack[]>([]);
	const [libraryRoot, setLibraryRoot] = useState<string | null>(null);
	const [progress, setProgress] = useState<ScanProgressEvent | null>(null);
	const [scanResult, setScanResult] = useState<ScanResult | null>(null);
	const [viewMode, setViewMode] = useState<ViewMode>("list");
	const bridgeRef = useRef<DesktopBridgeLibrary | null>(null);

	useEffect(() => {
		const shell = (window as unknown as { desktopShell?: { isDesktop?: () => boolean } })
			.desktopShell;
		if (!shell?.isDesktop?.()) {
			setState("not-desktop");
			return;
		}
		// Main window exposes library methods as desktopLibrary (preload/main.ts)
		// Trade window exposes them as desktopBridge (preload/trade.ts)
		const bridge =
			(
				window as unknown as {
					desktopLibrary?: DesktopBridgeLibrary;
					desktopBridge?: DesktopBridgeLibrary;
				}
			).desktopLibrary ??
			(window as unknown as { desktopBridge?: DesktopBridgeLibrary }).desktopBridge;
		if (!bridge?.getLibraryRoot) {
			setState("not-desktop");
			return;
		}
		bridgeRef.current = bridge;

		// Load existing library
		Promise.all([bridge.getLibraryRoot(), bridge.getLibraryTracks()])
			.then(([root, existingTracks]) => {
				setLibraryRoot(root);
				if (existingTracks.length > 0) {
					setTracks(existingTracks);
					setState("library");
				} else {
					setState("empty");
				}
			})
			.catch(() => {
				setState("empty");
			});
	}, []);

	const handleSelectFolder = useCallback(async () => {
		const bridge = bridgeRef.current;
		if (!bridge) return;
		const folder = await bridge.selectLibraryFolder();
		if (!folder) return;
		setLibraryRoot(folder);
		startScan(folder, "full");
	}, []);

	const startScan = useCallback(async (folder: string, mode: "incremental" | "full") => {
		const bridge = bridgeRef.current;
		if (!bridge) return;

		setState("scanning");
		setProgress({ filesFound: 0, filesProcessed: 0, currentPath: "" });

		const unsub = bridge.onScanProgress((event) => {
			setProgress(event);
		});

		try {
			const result =
				mode === "incremental" ? await bridge.startIncrementalScan() : await bridge.startFullScan();
			unsub();
			setScanResult(result);

			const updatedTracks = await bridge.getLibraryTracks();
			setTracks(updatedTracks);

			if (result.skippedFiles.length > 0) {
				setState("error-summary");
			} else {
				setState("library");
			}
		} catch {
			unsub();
			setState("library");
		}
	}, []);

	if (state === "loading") {
		return (
			<div className="flex items-center justify-center min-h-[60vh]">
				<span className="text-on-surface-variant text-sm animate-pulse">Carregando...</span>
			</div>
		);
	}

	if (state === "not-desktop") {
		return (
			<div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
				<span className="material-symbols-outlined text-[48px] text-on-surface-variant/40">
					desktop_windows
				</span>
				<h2 className="text-xl font-heading font-bold text-on-surface">Disponivel no Desktop</h2>
				<p className="text-on-surface-variant text-sm max-w-md text-center">
					A biblioteca local esta disponivel apenas no aplicativo desktop do DigSwap.
				</p>
			</div>
		);
	}

	if (state === "empty") {
		return (
			<div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
				<span className="material-symbols-outlined text-[48px] text-on-surface-variant/40">
					folder_open
				</span>
				<h2 className="text-xl font-heading font-bold text-on-surface">Minha Biblioteca</h2>
				<p className="text-on-surface-variant text-sm">
					Selecione uma pasta para escanear sua biblioteca de musica
				</p>
				<button
					type="button"
					onClick={handleSelectFolder}
					className="px-6 py-2.5 bg-primary text-on-primary rounded-lg font-mono text-sm uppercase tracking-wider hover:bg-primary/90 transition-colors"
				>
					Escolher Pasta
				</button>
				<span className="text-on-surface-variant/40 text-xs font-mono">FLAC, WAV, AIFF</span>
			</div>
		);
	}

	if (state === "scanning" && progress) {
		const percent =
			progress.filesFound > 0
				? Math.round((progress.filesProcessed / progress.filesFound) * 100)
				: 0;
		return (
			<div className="flex flex-col items-center justify-center min-h-[60vh] gap-6 px-8">
				<span className="text-on-surface-variant text-sm uppercase tracking-wider font-mono">
					Escaneando...
				</span>
				<div className="w-full max-w-lg">
					<div className="h-2 bg-surface-container-high rounded-full overflow-hidden">
						<div
							className="h-full bg-primary rounded-full transition-all duration-200"
							style={{ width: `${percent}%` }}
						/>
					</div>
					<div className="flex justify-between mt-2 text-xs text-on-surface-variant font-mono">
						<span>
							{progress.filesProcessed} / {progress.filesFound} arquivos
						</span>
						<span>{percent}%</span>
					</div>
				</div>
				<p className="text-on-surface-variant/60 text-xs font-mono truncate max-w-lg w-full text-center">
					{progress.currentPath}
				</p>
			</div>
		);
	}

	if (state === "error-summary" && scanResult) {
		return (
			<div className="flex flex-col items-center justify-center min-h-[60vh] gap-6 px-8">
				<span className="material-symbols-outlined text-[36px] text-error">warning</span>
				<h2 className="text-lg font-heading font-bold text-on-surface">
					Scan completo — {scanResult.skippedFiles.length} arquivo(s) ignorado(s)
				</h2>
				<div className="w-full max-w-lg max-h-48 overflow-y-auto bg-surface-container-high/50 rounded-lg p-4">
					{scanResult.skippedFiles.map((f) => (
						<div
							key={f.path}
							className="text-xs text-on-surface-variant py-1 border-b border-outline-variant/10 last:border-0"
						>
							<span className="font-mono truncate block">{f.path}</span>
							<span className="text-error/70">{f.reason}</span>
						</div>
					))}
				</div>
				<button
					type="button"
					onClick={() => setState("library")}
					className="px-6 py-2.5 bg-primary text-on-primary rounded-lg font-mono text-sm uppercase tracking-wider hover:bg-primary/90 transition-colors"
				>
					Ver Resultados
				</button>
			</div>
		);
	}

	// Library view
	const albumGroups =
		viewMode === "album"
			? tracks.reduce<Record<string, LibraryTrack[]>>((acc, track) => {
					const key = track.album || "Sem Album";
					if (!acc[key]) acc[key] = [];
					acc[key].push(track);
					return acc;
				}, {})
			: {};

	return (
		<div className="px-4 md:px-8 py-6">
			{/* Header */}
			<div className="flex items-center justify-between mb-6">
				<div>
					<h1 className="text-xl font-heading font-bold text-on-surface">Minha Biblioteca</h1>
					<p className="text-on-surface-variant text-xs font-mono mt-1">
						{tracks.length} faixa(s) {libraryRoot && `— ${libraryRoot}`}
					</p>
				</div>
				<div className="flex items-center gap-2">
					{/* View toggle */}
					<div className="flex bg-surface-container-high/50 rounded-lg p-0.5">
						<button
							type="button"
							onClick={() => setViewMode("list")}
							className={`p-1.5 rounded ${viewMode === "list" ? "bg-primary/15 text-primary" : "text-on-surface-variant hover:text-on-surface"}`}
							title="Lista"
						>
							<span className="material-symbols-outlined text-[18px]">view_list</span>
						</button>
						<button
							type="button"
							onClick={() => setViewMode("album")}
							className={`p-1.5 rounded ${viewMode === "album" ? "bg-primary/15 text-primary" : "text-on-surface-variant hover:text-on-surface"}`}
							title="Albuns"
						>
							<span className="material-symbols-outlined text-[18px]">grid_view</span>
						</button>
					</div>
					{/* Scan buttons */}
					{libraryRoot && (
						<>
							<button
								type="button"
								onClick={() => startScan(libraryRoot, "incremental")}
								className="px-3 py-1.5 text-xs font-mono uppercase tracking-wider text-on-surface-variant hover:text-on-surface bg-surface-container-high/50 rounded-lg hover:bg-surface-container-high transition-colors"
							>
								Re-scan
							</button>
							<button
								type="button"
								onClick={() => startScan(libraryRoot, "full")}
								className="px-3 py-1.5 text-xs font-mono uppercase tracking-wider text-on-surface-variant hover:text-on-surface bg-surface-container-high/50 rounded-lg hover:bg-surface-container-high transition-colors"
							>
								Re-scan Completo
							</button>
						</>
					)}
					<button
						type="button"
						onClick={handleSelectFolder}
						className="px-3 py-1.5 text-xs font-mono uppercase tracking-wider text-on-primary bg-primary rounded-lg hover:bg-primary/90 transition-colors"
					>
						Trocar Pasta
					</button>
				</div>
			</div>

			{/* List view */}
			{viewMode === "list" && (
				<div className="overflow-x-auto">
					<table className="w-full text-sm">
						<thead>
							<tr className="border-b border-outline-variant/10 text-on-surface-variant text-xs font-mono uppercase tracking-wider">
								<th className="text-left py-2 px-3">Titulo</th>
								<th className="text-left py-2 px-3">Artista</th>
								<th className="text-left py-2 px-3">Album</th>
								<th className="text-left py-2 px-3">Formato</th>
								<th className="text-right py-2 px-3">Bitrate</th>
								<th className="text-right py-2 px-3">Duracao</th>
							</tr>
						</thead>
						<tbody>
							{tracks.map((track) => (
								<tr
									key={track.id}
									className="border-b border-outline-variant/5 hover:bg-surface-container-high/30 transition-colors"
								>
									<td className="py-2 px-3">
										<InferredText value={track.title} confidence={track.titleConfidence} />
									</td>
									<td className="py-2 px-3">
										<InferredText value={track.artist} confidence={track.artistConfidence} />
									</td>
									<td className="py-2 px-3">
										<InferredText value={track.album} confidence={track.albumConfidence} />
									</td>
									<td className="py-2 px-3 font-mono text-xs uppercase text-on-surface-variant">
										{track.format}
									</td>
									<td className="py-2 px-3 text-right font-mono text-xs text-on-surface-variant">
										{formatBitrate(track.bitrate)}
									</td>
									<td className="py-2 px-3 text-right font-mono text-xs text-on-surface-variant">
										{formatDuration(track.duration)}
									</td>
								</tr>
							))}
						</tbody>
					</table>
				</div>
			)}

			{/* Album view */}
			{viewMode === "album" && (
				<div className="space-y-6">
					{Object.entries(albumGroups).map(([albumName, albumTracks]) => {
						const firstTrack = albumTracks[0];
						return (
							<div key={albumName} className="bg-surface-container-high/20 rounded-xl p-4">
								<div className="flex items-center gap-3 mb-3 pb-3 border-b border-outline-variant/10">
									<span className="material-symbols-outlined text-[28px] text-on-surface-variant/40">
										album
									</span>
									<div>
										<h3 className="font-heading font-bold text-on-surface">
											<InferredText value={albumName} confidence={firstTrack.albumConfidence} />
										</h3>
										<p className="text-xs text-on-surface-variant">
											<InferredText
												value={firstTrack.artist}
												confidence={firstTrack.artistConfidence}
											/>
											{" — "}
											{albumTracks.length} faixa(s)
										</p>
									</div>
								</div>
								<div className="space-y-0.5">
									{albumTracks.map((track) => (
										<div
											key={track.id}
											className="flex items-center py-1.5 px-2 rounded hover:bg-surface-container-high/30 text-sm"
										>
											<span className="w-8 text-right text-xs font-mono text-on-surface-variant/40 mr-3">
												{track.trackNumber ?? "—"}
											</span>
											<span className="flex-1">
												<InferredText value={track.title} confidence={track.titleConfidence} />
											</span>
											<span className="text-xs font-mono text-on-surface-variant ml-4">
												{formatDuration(track.duration)}
											</span>
										</div>
									))}
								</div>
							</div>
						);
					})}
				</div>
			)}
		</div>
	);
}
