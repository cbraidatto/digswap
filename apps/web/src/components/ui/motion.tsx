"use client";

import { type HTMLMotionProps, motion, type Variants } from "framer-motion";
import { forwardRef } from "react";

// ── Shared easing ──────────────────────────────────────────
export const ease = {
	smooth: [0.25, 0.1, 0.25, 1] as const,
	snappy: [0.19, 1, 0.22, 1] as const,
	bounce: [0.34, 1.56, 0.64, 1] as const,
};

// ── Fade + slide-up (default list/card entrance) ───────────
export const fadeUp: Variants = {
	hidden: { opacity: 0, y: 12 },
	visible: { opacity: 1, y: 0, transition: { duration: 0.35, ease: ease.smooth } },
	exit: { opacity: 0, y: -8, transition: { duration: 0.2 } },
};

export const fadeIn: Variants = {
	hidden: { opacity: 0 },
	visible: { opacity: 1, transition: { duration: 0.3 } },
	exit: { opacity: 0, transition: { duration: 0.15 } },
};

export const scaleIn: Variants = {
	hidden: { opacity: 0, scale: 0.95 },
	visible: { opacity: 1, scale: 1, transition: { duration: 0.25, ease: ease.snappy } },
	exit: { opacity: 0, scale: 0.95, transition: { duration: 0.15 } },
};

// ── Stagger container ──────────────────────────────────────
export const stagger = (staggerDelay = 0.05): Variants => ({
	hidden: {},
	visible: {
		transition: {
			staggerChildren: staggerDelay,
			delayChildren: 0.05,
		},
	},
});

// ── AnimatedCard — hover lift + tap press ──────────────────
export const AnimatedCard = forwardRef<HTMLDivElement, HTMLMotionProps<"div">>(
	({ children, className, ...props }, ref) => (
		<motion.div
			ref={ref}
			className={className}
			whileHover={{ y: -2, transition: { duration: 0.2, ease: ease.smooth } }}
			whileTap={{ scale: 0.985 }}
			{...props}
		>
			{children}
		</motion.div>
	),
);
AnimatedCard.displayName = "AnimatedCard";

// ── AnimatedList — staggered children ──────────────────────
export function AnimatedList({
	children,
	className,
	staggerDelay = 0.05,
}: {
	children: React.ReactNode;
	className?: string;
	staggerDelay?: number;
}) {
	return (
		<motion.div
			className={className}
			variants={stagger(staggerDelay)}
			initial="hidden"
			animate="visible"
		>
			{children}
		</motion.div>
	);
}

// ── AnimatedItem — single item in a staggered list ─────────
export function AnimatedItem({
	children,
	className,
}: {
	children: React.ReactNode;
	className?: string;
}) {
	return (
		<motion.div className={className} variants={fadeUp}>
			{children}
		</motion.div>
	);
}

// ── PageTransition — wraps route content ───────────────────
export function PageTransition({
	children,
	className,
}: {
	children: React.ReactNode;
	className?: string;
}) {
	return (
		<motion.div
			className={className}
			initial={{ opacity: 0, y: 8 }}
			animate={{ opacity: 1, y: 0 }}
			transition={{ duration: 0.3, ease: ease.smooth }}
		>
			{children}
		</motion.div>
	);
}
