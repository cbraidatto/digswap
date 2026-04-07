"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { globalSearchAction } from "@/actions/search";

/**
 * Check if the BarcodeDetector API is available in this browser.
 */
function isBarcodeApiSupported(): boolean {
	return typeof window !== "undefined" && "BarcodeDetector" in window;
}

export function BarcodeScanner() {
	const router = useRouter();
	const [isOpen, setIsOpen] = useState(false);
	const [scanning, setScanning] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const videoRef = useRef<HTMLVideoElement>(null);
	const streamRef = useRef<MediaStream | null>(null);
	const animFrameRef = useRef<number>(0);

	const supported = isBarcodeApiSupported();

	const stopCamera = useCallback(() => {
		if (streamRef.current) {
			streamRef.current.getTracks().forEach((t) => t.stop());
			streamRef.current = null;
		}
		cancelAnimationFrame(animFrameRef.current);
		setScanning(false);
	}, []);

	const close = useCallback(() => {
		stopCamera();
		setIsOpen(false);
		setError(null);
	}, [stopCamera]);

	// Cleanup on unmount
	useEffect(() => {
		return () => stopCamera();
	}, [stopCamera]);

	async function startScanning() {
		setIsOpen(true);
		setError(null);
		setScanning(true);

		try {
			const stream = await navigator.mediaDevices.getUserMedia({
				video: { facingMode: "environment" },
			});
			streamRef.current = stream;

			if (videoRef.current) {
				videoRef.current.srcObject = stream;
				await videoRef.current.play();
			}

			// @ts-expect-error — BarcodeDetector is not in TypeScript's lib yet
			const detector = new window.BarcodeDetector({
				formats: ["ean_13", "ean_8", "upc_a", "upc_e"],
			});

			const scan = async () => {
				if (!videoRef.current || !streamRef.current) return;

				try {
					const barcodes = await detector.detect(videoRef.current);
					if (barcodes.length > 0) {
						const code = barcodes[0].rawValue;
						stopCamera();

						// Search for the barcode
						toast.info(`Barcode detected: ${code}`);
						const results = await globalSearchAction(code);

						if (results.records.length > 0 && results.records[0].discogsId) {
							toast.success(`Found: ${results.records[0].title}`);
							router.push(`/release/${results.records[0].discogsId}`);
							close();
						} else {
							setError(`No release found for barcode ${code}. Try searching manually.`);
							setScanning(false);
						}
						return;
					}
				} catch {
					// Detection error — continue scanning
				}

				animFrameRef.current = requestAnimationFrame(scan);
			};

			animFrameRef.current = requestAnimationFrame(scan);
		} catch (_err) {
			setError("Camera access denied. Please allow camera access to scan barcodes.");
			setScanning(false);
		}
	}

	if (!supported) return null;

	return (
		<>
			<button
				type="button"
				onClick={() => (isOpen ? close() : startScanning())}
				aria-label="Scan barcode"
				className="p-2 rounded-full text-on-surface-variant hover:text-primary hover:bg-surface-container-high/80 transition-colors"
				title="Scan vinyl barcode"
			>
				<span className="material-symbols-outlined text-[20px]">qr_code_scanner</span>
			</button>

			{/* Scanner overlay */}
			{isOpen && (
				<div className="fixed inset-0 z-[100] bg-black/90 flex flex-col items-center justify-center p-4">
					{/* Close button */}
					<button
						type="button"
						onClick={close}
						className="absolute top-4 right-4 p-2 text-white hover:text-primary transition-colors"
					>
						<span className="material-symbols-outlined text-2xl">close</span>
					</button>

					<p className="font-mono text-xs text-white/60 mb-4">
						Point your camera at a vinyl barcode
					</p>

					{/* Video feed */}
					<div className="relative w-full max-w-sm aspect-square rounded-xl overflow-hidden border-2 border-primary/30">
						<video ref={videoRef} className="w-full h-full object-cover" playsInline muted />
						{/* Scanning overlay */}
						{scanning && (
							<div className="absolute inset-0 flex items-center justify-center">
								<div className="w-48 h-48 border-2 border-primary rounded-lg animate-pulse" />
							</div>
						)}
					</div>

					{/* Error */}
					{error && (
						<div className="mt-4 bg-destructive/10 border border-destructive/30 rounded-lg px-4 py-3 max-w-sm">
							<p className="font-mono text-xs text-destructive">{error}</p>
							<button
								type="button"
								onClick={() => {
									setError(null);
									startScanning();
								}}
								className="font-mono text-xs text-primary mt-2 hover:underline"
							>
								Try again
							</button>
						</div>
					)}

					{/* Status */}
					{scanning && (
						<p className="mt-4 font-mono text-xs text-primary animate-pulse">Scanning...</p>
					)}
				</div>
			)}
		</>
	);
}
