import Link from "next/link";

interface PaginationProps {
	currentPage: number;
	totalPages: number;
	baseUrl: string;
	searchParams: Record<string, string>;
}

function buildPageUrl(
	baseUrl: string,
	searchParams: Record<string, string>,
	page: number,
): string {
	const params = new URLSearchParams(searchParams);
	if (page <= 1) {
		params.delete("page");
	} else {
		params.set("page", String(page));
	}
	const qs = params.toString();
	return qs ? `${baseUrl}?${qs}` : baseUrl;
}

export function Pagination({
	currentPage,
	totalPages,
	baseUrl,
	searchParams,
}: PaginationProps) {
	const hasPrevious = currentPage > 1;
	const hasNext = currentPage < totalPages;

	return (
		<nav
			aria-label="Collection pagination"
			className="flex items-center justify-center gap-4 mt-8 py-4"
		>
			{hasPrevious ? (
				<Link
					href={buildPageUrl(baseUrl, searchParams, currentPage - 1)}
					className="font-mono text-xs uppercase tracking-widest text-primary hover:text-primary/80 transition-colors"
				>
					&lt; Previous
				</Link>
			) : (
				<span className="font-mono text-xs uppercase tracking-widest text-on-surface-variant/40">
					&lt; Previous
				</span>
			)}

			<span className="font-mono text-xs text-on-surface-variant">
				Page {currentPage} of {totalPages}
			</span>

			{hasNext ? (
				<Link
					href={buildPageUrl(baseUrl, searchParams, currentPage + 1)}
					className="font-mono text-xs uppercase tracking-widest text-primary hover:text-primary/80 transition-colors"
				>
					Next &gt;
				</Link>
			) : (
				<span className="font-mono text-xs uppercase tracking-widest text-on-surface-variant/40">
					Next &gt;
				</span>
			)}
		</nav>
	);
}
