import type { ReactNode } from "react";

export default function AuthLayout({ children }: { children: ReactNode }) {
	return (
		<div className="flex min-h-dvh flex-col items-center justify-center bg-background px-4 py-8">
			<div className="mb-8">
				<h1 className="font-heading text-[28px] font-normal tracking-[-0.03em] leading-[1.1] text-foreground sm:text-[36px]">
					<span className="text-primary">DIG</span>SWAP
				</h1>
			</div>
			<div className="w-full max-w-[420px]">{children}</div>
		</div>
	);
}
