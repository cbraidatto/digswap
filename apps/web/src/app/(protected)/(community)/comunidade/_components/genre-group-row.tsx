import Link from "next/link";

interface GenreGroupRowProps {
	name: string;
	slug: string;
	memberCount: number;
}

function formatCount(n: number): string {
	if (n >= 1000) {
		return `${(n / 1000).toFixed(1).replace(/\.0$/, "")}k`;
	}
	return n.toLocaleString();
}

export function GenreGroupRow({ name, slug, memberCount }: GenreGroupRowProps) {
	return (
		<Link
			href={`/comunidade/${slug}`}
			className="flex items-baseline gap-2 group py-1"
		>
			<span className="font-mono text-xs text-on-surface group-hover:text-primary transition-colors whitespace-nowrap">
				{name}
			</span>
			<span
				className="flex-1 border-b border-dotted border-outline-variant/30 min-w-[20px] translate-y-[-3px]"
				aria-hidden="true"
			/>
			<span className="font-mono text-xs text-on-surface-variant whitespace-nowrap">
				{formatCount(memberCount)} members
			</span>
		</Link>
	);
}
