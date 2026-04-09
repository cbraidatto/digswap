"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import { useCallback, useRef, useState } from "react";
import { saveCoverPosition, uploadCoverImage } from "@/actions/profile";

interface CoverBannerProps {
	initialCoverUrl: string | null;
	initialPositionY: number;
	isOwner: boolean;
}

export function CoverBanner({ initialCoverUrl, initialPositionY, isOwner }: CoverBannerProps) {
	const [coverUrl, setCoverUrl] = useState<string | null>(initialCoverUrl);
	const [positionY, setPositionY] = useState(initialPositionY);
	const [isRepositioning, setIsRepositioning] = useState(false);
	const [isUploading, setIsUploading] = useState(false);
	const [pendingFile, setPendingFile] = useState<File | null>(null);
	const [pendingPreview, setPendingPreview] = useState<string | null>(null);
	const [pendingPositionY, setPendingPositionY] = useState(50);

	const router = useRouter();
	const fileInputRef = useRef<HTMLInputElement>(null);
	const dragRef = useRef<{ startY: number; startPos: number } | null>(null);
	const imgRef = useRef<HTMLImageElement>(null);

	// ─── File selection ───────────────────────────────────────────────
	function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
		const file = e.target.files?.[0];
		if (!file) return;
		// Use FileReader to get a data: URL — works everywhere, no CSP issues
		const reader = new FileReader();
		reader.onload = (ev) => {
			const dataUrl = ev.target?.result as string;
			setPendingFile(file);
			setPendingPreview(dataUrl);
			setPendingPositionY(50);
			setIsRepositioning(true);
		};
		reader.readAsDataURL(file);
		// reset input so same file can be reselected
		e.target.value = "";
	}

	// ─── Drag to reposition ───────────────────────────────────────────
	const onDragStart = useCallback(
		(clientY: number) => {
			dragRef.current = { startY: clientY, startPos: pendingPositionY };
		},
		[pendingPositionY],
	);

	const onDragMove = useCallback((clientY: number) => {
		if (!dragRef.current || !imgRef.current) return;
		const imgH = imgRef.current.naturalHeight || 1;
		const frameH = 180; // banner height in px
		// How many % does 1px of drag translate to?
		const scale = (frameH / imgH) * 100;
		const delta = (clientY - dragRef.current.startY) * scale * 0.8;
		const next = Math.min(100, Math.max(0, dragRef.current.startPos - delta));
		setPendingPositionY(next);
	}, []);

	const onDragEnd = useCallback(() => {
		dragRef.current = null;
	}, []);

	// Mouse
	function onMouseDown(e: React.MouseEvent) {
		e.preventDefault();
		onDragStart(e.clientY);
		window.addEventListener("mousemove", handleWindowMouseMove);
		window.addEventListener("mouseup", handleWindowMouseUp, { once: true });
	}
	function handleWindowMouseMove(e: MouseEvent) {
		onDragMove(e.clientY);
	}
	function handleWindowMouseUp() {
		onDragEnd();
		window.removeEventListener("mousemove", handleWindowMouseMove);
	}

	// Touch
	function onTouchStart(e: React.TouchEvent) {
		onDragStart(e.touches[0].clientY);
	}
	function onTouchMove(e: React.TouchEvent) {
		onDragMove(e.touches[0].clientY);
	}
	function onTouchEnd() {
		onDragEnd();
	}

	// ─── Save ─────────────────────────────────────────────────────────
	async function handleSave() {
		if (!pendingFile) return;
		setIsUploading(true);

		const fd = new FormData();
		fd.append("cover", pendingFile);
		const result = await uploadCoverImage(fd);

		if ("error" in result) {
			setIsUploading(false);
			alert(result.error);
			return;
		}

		await saveCoverPosition(pendingPositionY);

		setCoverUrl(result.url ?? null);
		setPositionY(pendingPositionY);
		setPendingFile(null);
		setPendingPreview(null);
		setIsRepositioning(false);
		setIsUploading(false);
		router.refresh();
	}

	function handleCancel() {
		setPendingFile(null);
		setPendingPreview(null);
		setIsRepositioning(false);
	}

	// ─── Render ───────────────────────────────────────────────────────
	return (
		<>
			{/* Main banner */}
			<div className="relative w-full h-[180px] bg-surface-container-low overflow-hidden group">
				{coverUrl ? (
					<Image
						src={coverUrl}
						alt="Profile cover"
						fill
						unoptimized
						className="w-full h-full object-cover"
						style={{ objectPosition: `center ${positionY}%` }}
					/>
				) : (
					<>
						<div
							className="absolute inset-0 opacity-[0.04]"
							style={{
								backgroundImage: "radial-gradient(var(--primary) 1px, transparent 1px)",
								backgroundSize: "24px 24px",
							}}
						/>
						<div className="absolute inset-0 flex items-center justify-center">
							<span className="font-mono text-xs uppercase tracking-[0.3em] text-outline border border-outline/20 px-4 py-2">
								profile_cover
							</span>
						</div>
					</>
				)}

				{/* Edit button — owner only */}
				{isOwner && (
					<button
						type="button"
						onClick={() => fileInputRef.current?.click()}
						className="absolute bottom-3 right-3 flex items-center gap-1.5 font-mono text-xs uppercase tracking-[0.15em] px-3 py-1.5 rounded bg-black/60 text-white border border-white/20 opacity-0 group-hover:opacity-100 transition-opacity hover:bg-black/80"
					>
						<span className="material-symbols-outlined text-sm leading-none">photo_camera</span>
						edit cover
					</button>
				)}

				<input
					ref={fileInputRef}
					type="file"
					accept="image/jpeg,image/jpg,image/png,image/webp"
					className="hidden"
					onChange={handleFileChange}
				/>
			</div>

			{/* Reposition modal */}
			{isRepositioning && pendingPreview && (
				<div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-black/80 backdrop-blur-sm">
					<div className="w-full max-w-3xl px-4">
						{/* Header */}
						<div className="flex items-center justify-between mb-4">
							<span className="font-mono text-xs uppercase tracking-[0.2em] text-on-surface-variant">
								{"// arraste para reposicionar"}
							</span>
							<div className="flex gap-3">
								<button
									type="button"
									onClick={handleCancel}
									disabled={isUploading}
									className="font-mono text-xs uppercase tracking-[0.15em] px-4 py-2 border border-outline/30 text-on-surface-variant hover:text-on-surface transition-colors rounded"
								>
									cancelar
								</button>
								<button
									type="button"
									onClick={handleSave}
									disabled={isUploading}
									className="font-mono text-xs uppercase tracking-[0.15em] px-4 py-2 bg-primary text-on-primary rounded hover:bg-primary/90 transition-colors disabled:opacity-50"
								>
									{isUploading ? "salvando..." : "salvar"}
								</button>
							</div>
						</div>

						{/* Preview frame */}
						<div
							role="slider"
							tabIndex={0}
							aria-label="Reposition cover image"
							aria-valuemin={0}
							aria-valuemax={100}
							aria-valuenow={Math.round(pendingPositionY)}
							className="relative w-full h-[180px] overflow-hidden rounded cursor-ns-resize select-none border border-outline/20"
							onMouseDown={onMouseDown}
							onTouchStart={onTouchStart}
							onTouchMove={onTouchMove}
							onTouchEnd={onTouchEnd}
							onKeyDown={(e) => {
								if (e.key === "ArrowUp") {
									e.preventDefault();
									setPendingPositionY((prev) => Math.min(100, prev + 2));
								} else if (e.key === "ArrowDown") {
									e.preventDefault();
									setPendingPositionY((prev) => Math.max(0, prev - 2));
								}
							}}
						>
							{/* eslint-disable-next-line @next/next/no-img-element */}
							<img
								ref={imgRef}
								src={pendingPreview}
								alt="Cover preview"
								draggable={false}
								className="absolute inset-0 w-full h-full object-cover pointer-events-none"
								style={{ objectPosition: `center ${pendingPositionY}%` }}
							/>
							{/* Drag hint — bottom edge only */}
							<div className="absolute bottom-3 left-1/2 -translate-x-1/2 pointer-events-none">
								<span className="font-mono text-[9px] text-white/50 uppercase tracking-widest bg-black/40 px-3 py-1 rounded">
									↕ drag to reposition
								</span>
							</div>
						</div>
					</div>
				</div>
			)}
		</>
	);
}
