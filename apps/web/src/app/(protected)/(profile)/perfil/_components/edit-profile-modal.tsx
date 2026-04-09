"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import { useRef, useState, useTransition } from "react";
import { updateProfile, uploadAvatar } from "@/actions/profile";

interface EditProfileModalProps {
	initial: {
		displayName?: string | null;
		username?: string | null;
		location?: string | null;
		bio?: string | null;
		youtubeUrl?: string | null;
		instagramUrl?: string | null;
		soundcloudUrl?: string | null;
		discogsUrl?: string | null;
		beatportUrl?: string | null;
		avatarUrl?: string | null;
	};
}

export function EditProfileModal({ initial }: EditProfileModalProps) {
	const router = useRouter();
	const [open, setOpen] = useState(false);
	const [displayName, setDisplayName] = useState<string>(initial.displayName ?? "");
	const [username, setUsername] = useState<string>(initial.username ?? "");
	const [location, setLocation] = useState<string>(initial.location ?? "");
	const [bio, setBio] = useState<string>(initial.bio ?? "");
	const [youtubeUrl, setYoutubeUrl] = useState<string>(initial.youtubeUrl ?? "");
	const [instagramUrl, setInstagramUrl] = useState<string>(initial.instagramUrl ?? "");
	const [soundcloudUrl, setSoundcloudUrl] = useState<string>(initial.soundcloudUrl ?? "");
	const [discogsUrl, setDiscogsUrl] = useState<string>(initial.discogsUrl ?? "");
	const [beatportUrl, setBeatportUrl] = useState<string>(initial.beatportUrl ?? "");
	const [avatarUrl, setAvatarUrl] = useState<string | null>(initial.avatarUrl ?? null);
	const [isUploadingAvatar, setIsUploadingAvatar] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const [isPending, startTransition] = useTransition();
	const avatarInputRef = useRef<HTMLInputElement>(null);

	function handleOpen() {
		setDisplayName(initial.displayName ?? "");
		setUsername(initial.username ?? "");
		setLocation(initial.location ?? "");
		setBio(initial.bio ?? "");
		setYoutubeUrl(initial.youtubeUrl ?? "");
		setInstagramUrl(initial.instagramUrl ?? "");
		setSoundcloudUrl(initial.soundcloudUrl ?? "");
		setDiscogsUrl(initial.discogsUrl ?? "");
		setBeatportUrl(initial.beatportUrl ?? "");
		setAvatarUrl(initial.avatarUrl ?? null);
		setError(null);
		setOpen(true);
	}

	async function handleAvatarChange(e: React.ChangeEvent<HTMLInputElement>) {
		const file = e.target.files?.[0];
		if (!file) return;
		e.target.value = "";
		setIsUploadingAvatar(true);
		const fd = new FormData();
		fd.append("avatar", file);
		const result = await uploadAvatar(fd);
		setIsUploadingAvatar(false);
		if ("error" in result) {
			setError(result.error ?? "Failed to upload avatar.");
		} else {
			setAvatarUrl(result.url ?? null);
		}
	}

	function handleSave() {
		setError(null);
		startTransition(async () => {
			const result = await updateProfile({
				displayName,
				username,
				location,
				bio,
				youtubeUrl,
				instagramUrl,
				soundcloudUrl,
				discogsUrl,
				beatportUrl,
			});
			if ("error" in result) {
				setError(result.error ?? "Failed to update profile.");
				return;
			}
			router.refresh();
			setOpen(false);
		});
	}

	return (
		<>
			<button
				type="button"
				onClick={handleOpen}
				className="flex items-center gap-1 font-mono text-[9px] uppercase tracking-[0.15em] px-2 py-1 border border-outline/20 text-outline hover:text-on-surface-variant hover:border-outline/40 transition-colors rounded"
			>
				<span className="material-symbols-outlined text-xs leading-none">edit</span>
				Edit
			</button>

			{open && (
				<div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
					<div className="w-full max-w-md bg-surface-container-low border border-outline/20 rounded-lg overflow-hidden">
						{/* Header */}
						<div className="flex items-center justify-between px-6 py-4 border-b border-outline/10">
							<span className="font-mono text-xs uppercase tracking-[0.2em] text-on-surface-variant">
								edit_profile
							</span>
							<button
								type="button"
								onClick={() => setOpen(false)}
								className="text-on-surface-variant hover:text-on-surface transition-colors font-mono text-sm"
							>
								✕
							</button>
						</div>

						{/* Fields */}
						<div
							className="px-6 py-6 space-y-5 overflow-y-auto max-h-[60vh]"
							style={{
								scrollbarWidth: "thin",
								scrollbarColor: "rgba(255,255,255,0.1) transparent",
							}}
						>
							{/* Avatar */}
							<div className="flex items-center gap-4">
								<div className="relative group flex-shrink-0">
									<div className="w-16 h-16 rounded border-2 border-primary/20 overflow-hidden bg-surface-container-high flex items-center justify-center">
										{avatarUrl ? (
											<Image
												src={avatarUrl}
												alt="Avatar"
												width={64}
												height={64}
												unoptimized
												className="w-full h-full object-cover"
											/>
										) : (
											<span className="text-2xl font-mono font-bold text-primary">
												{(displayName || "D").charAt(0).toUpperCase()}
											</span>
										)}
									</div>
									<button
										type="button"
										onClick={() => avatarInputRef.current?.click()}
										disabled={isUploadingAvatar}
										className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity rounded flex items-center justify-center disabled:cursor-wait"
									>
										{isUploadingAvatar ? (
											<span className="material-symbols-outlined text-white text-base animate-spin">
												progress_activity
											</span>
										) : (
											<span className="material-symbols-outlined text-white text-base">
												photo_camera
											</span>
										)}
									</button>
									<input
										ref={avatarInputRef}
										type="file"
										accept="image/jpeg,image/jpg,image/png,image/webp"
										className="hidden"
										onChange={handleAvatarChange}
									/>
								</div>
								<div>
									<p className="font-mono text-xs uppercase tracking-[0.2em] text-on-surface-variant">
										Avatar
									</p>
									<p className="font-mono text-[9px] text-outline mt-0.5">
										Max 2MB · JPG, PNG, WebP
									</p>
								</div>
							</div>

							{/* Display Name */}
							<div>
								<label
									htmlFor="edit-display-name"
									className="block font-mono text-xs uppercase tracking-[0.2em] text-on-surface-variant mb-2"
								>
									Display Name
								</label>
								<input
									id="edit-display-name"
									type="text"
									value={displayName}
									onChange={(e) => setDisplayName(e.target.value)}
									maxLength={50}
									className="w-full bg-surface-container-lowest border border-outline/20 rounded px-3 py-2 font-mono text-sm text-on-surface focus:outline-none focus:border-primary/50 transition-colors"
									placeholder="Your name"
								/>
							</div>

							{/* Username */}
							<div>
								<label
									htmlFor="edit-username"
									className="block font-mono text-xs uppercase tracking-[0.2em] text-on-surface-variant mb-2"
								>
									Username
								</label>
								<div className="relative">
									<span className="absolute left-3 top-1/2 -translate-y-1/2 font-mono text-sm text-on-surface-variant">
										@
									</span>
									<input
										id="edit-username"
										type="text"
										value={username}
										onChange={(e) =>
											setUsername(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ""))
										}
										maxLength={30}
										className="w-full bg-surface-container-lowest border border-outline/20 rounded pl-7 pr-3 py-2 font-mono text-sm text-on-surface focus:outline-none focus:border-primary/50 transition-colors"
										placeholder="username"
									/>
								</div>
								<p className="font-mono text-[9px] text-outline mt-1">
									letters, numbers and _ only
								</p>
							</div>

							{/* Location */}
							<div>
								<label
									htmlFor="edit-location"
									className="block font-mono text-xs uppercase tracking-[0.2em] text-on-surface-variant mb-2"
								>
									Location
								</label>
								<input
									id="edit-location"
									type="text"
									value={location}
									onChange={(e) => setLocation(e.target.value)}
									maxLength={300}
									className="w-full bg-surface-container-lowest border border-outline/20 rounded px-3 py-2 font-mono text-sm text-on-surface focus:outline-none focus:border-primary/50 transition-colors"
									placeholder="São Paulo, Brazil"
								/>
							</div>

							{/* Bio */}
							<div>
								<label
									htmlFor="edit-bio"
									className="block font-mono text-xs uppercase tracking-[0.2em] text-on-surface-variant mb-2"
								>
									Bio
								</label>
								<textarea
									id="edit-bio"
									value={bio}
									onChange={(e) => setBio(e.target.value)}
									maxLength={300}
									rows={3}
									className="w-full bg-surface-container-lowest border border-outline/20 rounded px-3 py-2 font-mono text-sm text-on-surface focus:outline-none focus:border-primary/50 transition-colors resize-none"
									placeholder="Tell the crate about yourself..."
								/>
								<p className="font-mono text-[9px] text-outline mt-1 text-right">
									{bio.length} / 300
								</p>
							</div>

							{/* Social Links */}
							<div className="pt-2 border-t border-outline/10">
								<p className="font-mono text-xs uppercase tracking-[0.2em] text-on-surface-variant mb-4">
									Social Links
								</p>
								<div className="space-y-3">
									{(
										[
											{
												label: "YouTube",
												value: youtubeUrl,
												set: setYoutubeUrl,
												placeholder: "https://youtube.com/@channel",
											},
											{
												label: "Instagram",
												value: instagramUrl,
												set: setInstagramUrl,
												placeholder: "https://instagram.com/username",
											},
											{
												label: "SoundCloud",
												value: soundcloudUrl,
												set: setSoundcloudUrl,
												placeholder: "https://soundcloud.com/username",
											},
											{
												label: "Discogs",
												value: discogsUrl,
												set: setDiscogsUrl,
												placeholder: "https://www.discogs.com/user/username",
											},
											{
												label: "Beatport",
												value: beatportUrl,
												set: setBeatportUrl,
												placeholder: "https://www.beatport.com/artist/...",
											},
										] as const
									).map(({ label, value, set, placeholder }) => (
										<div key={label} className="flex items-center gap-3">
											<span className="font-mono text-xs text-on-surface-variant w-20 flex-shrink-0">
												{label}
											</span>
											<input
												type="url"
												value={value}
												onChange={(e) => (set as (v: string) => void)(e.target.value)}
												placeholder={placeholder}
												className="flex-1 bg-surface-container-lowest border border-outline/20 rounded px-3 py-1.5 font-mono text-xs text-on-surface focus:outline-none focus:border-primary/50 transition-colors placeholder:text-outline/40"
											/>
										</div>
									))}
								</div>
							</div>

							{error && <p className="font-mono text-xs text-red-400">{error}</p>}
						</div>

						{/* Footer */}
						<div className="flex justify-end gap-3 px-6 py-4 border-t border-outline/10">
							<button
								type="button"
								onClick={() => setOpen(false)}
								disabled={isPending}
								className="font-mono text-xs uppercase tracking-[0.15em] px-4 py-2 border border-outline/30 text-on-surface-variant hover:text-on-surface transition-colors rounded"
							>
								Cancel
							</button>
							<button
								type="button"
								onClick={handleSave}
								disabled={isPending}
								className="font-mono text-xs uppercase tracking-[0.15em] px-4 py-2 bg-primary text-on-primary rounded hover:bg-primary/90 transition-colors disabled:opacity-50"
							>
								{isPending ? "Saving..." : "Save"}
							</button>
						</div>
					</div>
				</div>
			)}
		</>
	);
}
