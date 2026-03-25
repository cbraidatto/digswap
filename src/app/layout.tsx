import type { Metadata, Viewport } from "next";
import { DM_Sans, Fraunces } from "next/font/google";
import { Toaster } from "@/components/ui/sonner";
import "./globals.css";

const dmSans = DM_Sans({
	subsets: ["latin"],
	weight: ["400", "600"],
	display: "swap",
	variable: "--font-dm-sans",
});

const fraunces = Fraunces({
	subsets: ["latin"],
	weight: ["400", "600"],
	display: "swap",
	variable: "--font-fraunces",
});

export const metadata: Metadata = {
	title: "VinylDig",
	description: "A social network for vinyl diggers",
};

export const viewport: Viewport = {
	viewportFit: "cover",
};

export default function RootLayout({
	children,
}: Readonly<{
	children: React.ReactNode;
}>) {
	return (
		<html lang="en" className={`${dmSans.variable} ${fraunces.variable}`}>
			<body className="font-sans antialiased">
				<div className="grain">{children}</div>
				<Toaster
					toastOptions={{
						style: {
							background: "oklch(0.18 0.02 55)",
							border: "1px solid oklch(0.25 0.02 55)",
							color: "oklch(0.90 0.01 70)",
						},
					}}
				/>
			</body>
		</html>
	);
}
