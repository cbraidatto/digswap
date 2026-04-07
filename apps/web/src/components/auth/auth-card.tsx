import type { ReactNode } from "react";
import {
	Card,
	CardContent,
	CardDescription,
	CardFooter,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";
import { cn } from "@/lib/utils";

interface AuthCardProps {
	title: string;
	subtitle?: string;
	children: ReactNode;
	footer?: ReactNode;
	wide?: boolean;
}

/**
 * Shared card wrapper for all auth forms.
 * Uses the dark-warm theme surface with consistent padding and max-width.
 *
 * @param wide - When true, uses 520px max-width (onboarding variant)
 */
export function AuthCard({ title, subtitle, children, footer, wide = false }: AuthCardProps) {
	return (
		<Card
			className={cn(
				"w-full border border-border bg-card p-6 sm:p-8",
				wide ? "max-w-[520px]" : "max-w-[420px]",
			)}
		>
			<CardHeader className="px-0 pt-0">
				<CardTitle className="font-heading text-2xl font-semibold tracking-[-0.02em] leading-[1.2] text-card-foreground">
					{title}
				</CardTitle>
				{subtitle && (
					<CardDescription className="text-sm text-muted-foreground">{subtitle}</CardDescription>
				)}
			</CardHeader>
			<CardContent className="px-0">{children}</CardContent>
			{footer && (
				<CardFooter className="justify-center border-t-0 bg-transparent px-0 pb-0 pt-4">
					<div className="text-sm text-muted-foreground">{footer}</div>
				</CardFooter>
			)}
		</Card>
	);
}
