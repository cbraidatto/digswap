import Link from "next/link";

interface RequestAudioButtonProps {
	userId: string;
	releaseId: string;
	p2pEnabled: boolean;
	isOwner: boolean;
}

export function RequestAudioButton({
	userId,
	releaseId,
	p2pEnabled,
	isOwner,
}: RequestAudioButtonProps) {
	if (!p2pEnabled || isOwner) return null;

	return (
		<Link
			href={`/trades/new?to=${userId}&release=${releaseId}`}
			className="font-mono text-[10px] text-primary hover:underline cursor-pointer flex items-center gap-1"
		>
			<span className="material-symbols-outlined text-[14px]">
				swap_horiz
			</span>
			REQUEST_AUDIO
		</Link>
	);
}
