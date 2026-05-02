import { Analytics } from "@vercel/analytics/next";
import { SpeedInsights } from "@vercel/speed-insights/next";
import type { Metadata, Viewport } from "next";
import { Inter, JetBrains_Mono, Space_Grotesk } from "next/font/google";
import { headers } from "next/headers";
import { DesktopSessionSync } from "@/components/desktop/desktop-session-sync";
import { ThemeProvider } from "@/components/theme-provider";
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
	title: "DigSwap — Find who has the record you're hunting",
	description:
		"The discovery layer serious diggers have been missing. Connect your Discogs library, find who owns your Holy Grails, and organize the hunt.",
};

export const viewport: Viewport = {
	viewportFit: "cover",
};

export default async function RootLayout({
	children,
}: Readonly<{
	children: React.ReactNode;
}>) {
	const nonce = (await headers()).get("x-nonce") ?? "";

	return (
		<html
			lang="en"
			className={`${inter.variable} ${spaceGrotesk.variable} ${jetbrainsMono.variable}`}
			suppressHydrationWarning
		>
			<head>
				<link rel="preconnect" href="https://fonts.googleapis.com" />
				<link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
				<link
					href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:opsz,wght,FILL,GRAD@24,400,0,0"
					rel="stylesheet"
				/>
				{/* Prevent theme flash on load */}
				{/* suppressHydrationWarning: browsers strip nonce from DOM after parse (security),
				    causing React hydration mismatch between server nonce and empty client DOM */}
				<script
					nonce={nonce}
					suppressHydrationWarning
					// biome-ignore lint/security/noDangerouslySetInnerHtml: theme flash prevention with static string, no user input
					dangerouslySetInnerHTML={{
						__html: `try{var t=localStorage.getItem('app-theme');if(t)document.documentElement.setAttribute('data-theme',t)}catch(e){}`,
					}}
				/>
			</head>
			<body className="font-sans antialiased">
				{/* WCAG 2.4.1: Skip to main content link */}
				<a
					href="#main-content"
					className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-[100] focus:bg-primary focus:text-background focus:px-4 focus:py-2 focus:rounded focus:font-mono focus:text-xs"
				>
					Skip to content
				</a>
				<DesktopSessionSync />
				<ThemeProvider>
					<div className="grain">{children}</div>
				</ThemeProvider>
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
				{/* Phase 39 — Vercel observability. Both auto-disable in dev. */}
				<Analytics />
				<SpeedInsights />
			</body>
		</html>
	);
}
