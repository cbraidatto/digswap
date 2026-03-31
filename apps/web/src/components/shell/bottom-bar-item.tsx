"use client";

import type { LucideIcon } from "lucide-react";
import Link from "next/link";
import { cn } from "@/lib/utils";

interface BottomBarItemProps {
	href: string;
	label: string;
	icon: LucideIcon;
	isActive: boolean;
}

export function BottomBarItem({ href, label, icon: Icon, isActive }: BottomBarItemProps) {
	return (
		<Link
			href={href}
			aria-current={isActive ? "page" : undefined}
			className={cn(
				"flex flex-1 flex-col items-center justify-center gap-1 py-2 transition-colors duration-150",
				isActive ? "text-primary" : "text-muted-foreground",
			)}
		>
			<Icon className="size-6" />
			<span className="text-xs font-semibold">{label}</span>
		</Link>
	);
}
