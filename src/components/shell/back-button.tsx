"use client";

import { useRouter } from "next/navigation";

export function BackButton() {
	const router = useRouter();

	return (
		<button
			type="button"
			onClick={() => router.back()}
			className="flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-[0.2em] text-on-surface-variant hover:text-on-surface transition-colors"
		>
			<span className="text-sm leading-none">&lt;</span>
			back
		</button>
	);
}
