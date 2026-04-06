import Link from "next/link";

interface RecordLinkProps {
	discogsId: number | null | undefined;
	children: React.ReactNode;
	className?: string;
}

/**
 * Wraps children in a Link to the release page when discogsId is available.
 * Falls back to a plain div when no discogsId.
 */
export function RecordLink({ discogsId, children, className }: RecordLinkProps) {
	if (!discogsId) {
		return <div className={className}>{children}</div>;
	}

	return (
		<Link href={`/release/${discogsId}`} className={className}>
			{children}
		</Link>
	);
}
