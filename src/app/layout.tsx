import type { Metadata, Viewport } from "next";
import { Inter, Space_Grotesk, JetBrains_Mono } from "next/font/google";
import { Toaster } from "@/components/ui/sonner";
import "./globals.css";

const inter = Inter({
	subsets: ["latin"],
	weight: ["300", "400", "500", "600"],
	display: "swap",
	variable: "--font-inter",
});

const spaceGrotesk = Space_Grotesk({
	subsets: ["latin"],
	weight: ["300", "400", "500", "600", "700"],
	display: "swap",
	variable: "--font-space-grotesk",
});

const jetbrainsMono = JetBrains_Mono({
	subsets: ["latin"],
	weight: ["400", "500"],
	display: "swap",
	variable: "--font-jetbrains-mono",
});

export const metadata: Metadata = {
	title: "DigSwap",
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
		<html
			lang="en"
			className={`${inter.variable} ${spaceGrotesk.variable} ${jetbrainsMono.variable}`}
		>
			<head>
				<link rel="preconnect" href="https://fonts.googleapis.com" />
				<link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
				<link
					href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:opsz,wght,FILL,GRAD@24,400,0,0"
					rel="stylesheet"
				/>
			</head>
			<body className="font-sans antialiased">
				<div className="grain">{children}</div>
				<Toaster
					toastOptions={{
						style: {
							background: "#181c22",
							border: "1px solid #3e4a3d",
							color: "#dfe2eb",
							fontFamily: "JetBrains Mono, monospace",
						},
					}}
				/>
			</body>
		</html>
	);
}
