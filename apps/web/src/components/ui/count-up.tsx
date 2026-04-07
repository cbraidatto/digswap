"use client";

import { useEffect, useRef, useState } from "react";

interface CountUpProps {
	end: number;
	duration?: number;
	className?: string;
	prefix?: string;
	suffix?: string;
	decimals?: number;
}

export function CountUp({
	end,
	duration = 1000,
	className,
	prefix = "",
	suffix = "",
	decimals = 0,
}: CountUpProps) {
	const [value, setValue] = useState(0);
	const ref = useRef<HTMLSpanElement>(null);
	const hasAnimated = useRef(false);

	useEffect(() => {
		if (hasAnimated.current) return;

		const observer = new IntersectionObserver(
			([entry]) => {
				if (!entry.isIntersecting || hasAnimated.current) return;
				hasAnimated.current = true;

				const start = performance.now();
				const animate = (now: number) => {
					const elapsed = now - start;
					const progress = Math.min(elapsed / duration, 1);
					// Ease-out cubic
					const eased = 1 - (1 - progress) ** 3;
					setValue(eased * end);
					if (progress < 1) requestAnimationFrame(animate);
				};
				requestAnimationFrame(animate);
			},
			{ threshold: 0.3 },
		);

		if (ref.current) observer.observe(ref.current);
		return () => observer.disconnect();
	}, [end, duration]);

	const display = decimals > 0 ? value.toFixed(decimals) : Math.round(value).toLocaleString();

	return (
		<span ref={ref} className={className}>
			{prefix}
			{display}
			{suffix}
		</span>
	);
}
