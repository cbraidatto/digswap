"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";

interface TransferProgressEvent {
	bytesReceived: number;
	totalBytes: number;
	peerConnected: boolean;
}
interface TransferCompleteEvent {
	filePath: string;
	sha256: string;
	tradeId: string;
}
interface DesktopBridge {
	startTransfer(tradeId: string): Promise<void>;
	cancelTransfer(tradeId: string): Promise<void>;
	confirmCompletion(tradeId: string, rating: number): Promise<void>;
	openFileInExplorer(filePath: string): Promise<void>;
	onTransferProgress(listener: (event: TransferProgressEvent) => void): () => void;
	onTransferComplete(listener: (event: TransferCompleteEvent) => void): () => void;
}

function getDesktopBridge(): DesktopBridge | undefined {
	return (window as Window & { desktopBridge?: DesktopBridge }).desktopBridge;
}

interface Props {
	tradeId: string;
}

type Phase = "ready" | "connecting" | "transferring" | "verifying" | "done" | "error";

function formatBytes(b: number) {
	if (b < 1024) return `${b} B`;
	if (b < 1024 * 1024) return `${(b / 1024).toFixed(1)} KB`;
	return `${(b / (1024 * 1024)).toFixed(1)} MB`;
}

function formatPath(p: string) {
	// Show just the last two path segments
	const parts = p.replace(/\\/g, "/").split("/");
	return parts.slice(-2).join("/");
}

export function TransferSection({ tradeId }: Props) {
	const router = useRouter();
	const [phase, setPhase] = useState<Phase>("ready");
	const [peerConnected, setPeerConnected] = useState(false);
	const [bytesReceived, setBytesReceived] = useState(0);
	const [totalBytes, setTotalBytes] = useState(0);
	const [filePath, setFilePath] = useState<string | null>(null);
	const [sha256, setSha256] = useState<string | null>(null);
	const [rating, setRating] = useState(0);
	const [error, setError] = useState<string | null>(null);
	const [submittingRating, setSubmittingRating] = useState(false);
	const unsubProgress = useRef<(() => void) | null>(null);
	const unsubComplete = useRef<(() => void) | null>(null);

	const bridge = typeof window !== "undefined" ? getDesktopBridge() : undefined;

	// Subscribe to events once on mount
	useEffect(() => {
		if (!bridge) return;

		unsubProgress.current = bridge.onTransferProgress((event) => {
			if (event.totalBytes > 0) setTotalBytes(event.totalBytes);
			setBytesReceived(event.bytesReceived);
			setPeerConnected(event.peerConnected);
			setPhase(event.peerConnected ? "transferring" : "connecting");
		});

		unsubComplete.current = bridge.onTransferComplete((event) => {
			if (event.tradeId !== tradeId) return;
			setFilePath(event.filePath);
			setSha256(event.sha256);
			setPhase("done");
		});

		return () => {
			unsubProgress.current?.();
			unsubComplete.current?.();
		};
	}, [bridge, tradeId]);

	async function handleStart() {
		if (!bridge) return;
		setPhase("connecting");
		setError(null);
		try {
			await bridge.startTransfer(tradeId);
		} catch (err) {
			const msg = err instanceof Error ? err.message : String(err);
			if (msg.toLowerCase().includes("cancel")) {
				setPhase("ready");
				return;
			}
			setError(msg);
			setPhase("error");
		}
	}

	async function handleCancel() {
		if (!bridge) return;
		try {
			await bridge.cancelTransfer(tradeId);
		} catch {}
		setPhase("ready");
		setBytesReceived(0);
		setTotalBytes(0);
		setPeerConnected(false);
	}

	async function handleConfirm() {
		if (!bridge || rating === 0) return;
		setSubmittingRating(true);
		try {
			await bridge.confirmCompletion(tradeId, rating);
			router.refresh();
		} catch (err) {
			setError(err instanceof Error ? err.message : "Failed to confirm completion.");
			setSubmittingRating(false);
		}
	}

	function openInExplorer() {
		if (!bridge || !filePath) return;
		void bridge.openFileInExplorer(filePath);
	}

	const progress = totalBytes > 0 ? (bytesReceived / totalBytes) * 100 : 0;

	// Not in desktop
	if (!bridge) {
		return (
			<div className="rounded-lg border border-secondary/25 bg-secondary/5 p-5 flex items-start gap-4">
				<div className="w-9 h-9 rounded-full bg-secondary/10 border border-secondary/20 flex items-center justify-center flex-shrink-0 text-secondary mt-0.5">
					<svg
						width="16"
						height="16"
						viewBox="0 0 24 24"
						fill="none"
						stroke="currentColor"
						strokeWidth="1.5"
					>
						<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
						<polyline points="7 10 12 15 17 10" />
						<line x1="12" y1="15" x2="12" y2="3" />
					</svg>
				</div>
				<div>
					<p className="text-sm font-semibold text-secondary">Open DigSwap Desktop to transfer</p>
					<p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">
						The P2P file transfer requires the desktop app. Open the trade there to continue.
					</p>
				</div>
			</div>
		);
	}

	// ── Done ──────────────────────────────────────────────────────────────────
	if (phase === "done") {
		return (
			<div className="rounded-lg border border-primary/25 overflow-hidden">
				<div className="px-4 py-3 bg-primary/8 border-b border-primary/20 flex items-center gap-2.5">
					<svg
						width="14"
						height="14"
						viewBox="0 0 24 24"
						fill="none"
						stroke="currentColor"
						strokeWidth="2.5"
						strokeLinecap="round"
						strokeLinejoin="round"
						className="text-primary"
					>
						<polyline points="20 6 9 17 4 12" />
					</svg>
					<span className="text-xs font-mono font-bold uppercase tracking-widest text-primary">
						Transfer Complete
					</span>
				</div>

				<div className="px-4 py-4 flex flex-col gap-4">
					{filePath && (
						<div className="rounded border border-outline-variant bg-surface-container-lowest p-3 flex items-center justify-between gap-3">
							<div className="min-w-0">
								<p className="text-xs font-mono text-muted-foreground/60 mb-0.5">Saved to</p>
								<p className="text-sm font-mono text-foreground truncate">{formatPath(filePath)}</p>
								{sha256 && (
									<p className="text-[10px] font-mono text-muted-foreground/40 mt-1">
										SHA-256: {sha256.slice(0, 16)}…
									</p>
								)}
							</div>
							<button
								type="button"
								onClick={openInExplorer}
								className="flex-shrink-0 text-xs font-mono text-primary/70 hover:text-primary transition-colors"
							>
								Show in Folder
							</button>
						</div>
					)}

					{/* Star rating */}
					<div className="flex flex-col gap-2">
						<p className="text-xs text-muted-foreground">Rate this trade</p>
						<div className="flex items-center gap-1">
							{[1, 2, 3, 4, 5].map((star) => (
								<button
									key={star}
									type="button"
									onClick={() => setRating(star)}
									className={[
										"text-2xl transition-colors leading-none",
										star <= rating
											? "text-amber-400"
											: "text-muted-foreground/20 hover:text-amber-400/50",
									].join(" ")}
								>
									★
								</button>
							))}
						</div>
					</div>

					{error && <p className="text-xs text-destructive font-mono">{error}</p>}

					<button
						type="button"
						disabled={rating === 0 || submittingRating}
						onClick={handleConfirm}
						className="w-full py-2.5 rounded text-sm font-medium bg-primary/15 border border-primary/40 text-primary hover:bg-primary/25 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
					>
						{submittingRating ? "Confirming…" : "Confirm & Complete Trade"}
					</button>
				</div>
			</div>
		);
	}

	// ── Ready / Connecting / In-progress / Error ───────────────────────────────
	return (
		<div className="rounded-lg border border-secondary/25 overflow-hidden">
			{/* Header */}
			<div className="px-4 py-3 bg-secondary/8 border-b border-secondary/20 flex items-center justify-between gap-3">
				<div className="flex items-center gap-2.5">
					{phase === "transferring" ? (
						<span className="w-1.5 h-1.5 rounded-full bg-secondary animate-pulse flex-shrink-0" />
					) : (
						<span className="w-1.5 h-1.5 rounded-full bg-secondary/40 flex-shrink-0" />
					)}
					<span className="text-xs font-mono font-bold uppercase tracking-widest text-secondary">
						{phase === "ready" && "Ready to Transfer"}
						{phase === "connecting" && "Connecting to Peer…"}
						{phase === "transferring" && "Transferring…"}
						{phase === "verifying" && "Verifying…"}
						{phase === "error" && "Transfer Failed"}
					</span>
				</div>

				{/* Peer indicator */}
				{(phase === "connecting" || phase === "transferring") && (
					<span
						className={[
							"text-[10px] font-mono flex items-center gap-1.5",
							peerConnected ? "text-primary" : "text-muted-foreground/50",
						].join(" ")}
					>
						<span
							className={[
								"w-1.5 h-1.5 rounded-full flex-shrink-0",
								peerConnected ? "bg-primary" : "bg-muted-foreground/30 animate-pulse",
							].join(" ")}
						/>
						{peerConnected ? "Peer connected" : "Waiting for peer…"}
					</span>
				)}
			</div>

			<div className="px-4 py-4 flex flex-col gap-4">
				{phase === "ready" && (
					<>
						<p className="text-xs text-muted-foreground">
							Both previews were approved. Start the P2P transfer to send or receive the full audio
							file.
						</p>
						<button
							type="button"
							onClick={handleStart}
							className="w-full py-2.5 rounded text-sm font-medium bg-secondary/15 border border-secondary/40 text-secondary hover:bg-secondary/25 transition-colors"
						>
							Start Transfer
						</button>
					</>
				)}

				{(phase === "connecting" || phase === "transferring") && (
					<>
						{/* Progress bar */}
						<div className="flex flex-col gap-1.5">
							<div className="flex items-center justify-between text-xs font-mono text-muted-foreground">
								<span>
									{formatBytes(bytesReceived)} / {totalBytes > 0 ? formatBytes(totalBytes) : "—"}
								</span>
								<span>{totalBytes > 0 ? `${progress.toFixed(1)}%` : "—"}</span>
							</div>
							<div className="w-full h-2 bg-surface-container rounded-full overflow-hidden">
								<div
									className={[
										"h-full rounded-full transition-all duration-300",
										peerConnected ? "bg-secondary" : "bg-muted-foreground/20",
									].join(" ")}
									style={{ width: `${progress}%` }}
								/>
							</div>
						</div>

						<button
							type="button"
							onClick={handleCancel}
							className="text-xs text-muted-foreground/60 hover:text-destructive transition-colors font-mono text-center"
						>
							Cancel transfer
						</button>
					</>
				)}

				{phase === "error" && (
					<>
						<p className="text-xs text-destructive font-mono">{error}</p>
						<button
							type="button"
							onClick={() => {
								setPhase("ready");
								setError(null);
							}}
							className="text-xs text-muted-foreground/60 hover:text-foreground transition-colors font-mono"
						>
							Try again
						</button>
					</>
				)}
			</div>
		</div>
	);
}
