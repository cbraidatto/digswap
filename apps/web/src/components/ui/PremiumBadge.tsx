interface Props {
	className?: string;
}

export function PremiumBadge({ className = "" }: Props) {
	return (
		<span
			title="Premium supporter"
			className={`inline-flex items-center bg-[#c8914a]/10 border border-[#c8914a]/30 text-[#c8914a] font-mono text-[9px] uppercase tracking-widest px-1.5 py-0.5 rounded ${className}`}
		>
			PREMIUM
		</span>
	);
}
