"use client";

import { createContext, useContext, useEffect, useState } from "react";

export type AppTheme = "ghost" | "chrome" | "rust" | "indigo";

export const THEMES: { id: AppTheme; name: string; primary: string; bg: string }[] = [
	{ id: "ghost", name: "Ghost Protocol", primary: "#6fdd78", bg: "#10141a" },
	{ id: "chrome", name: "Chrome", primary: "#c0c8d4", bg: "#0c0d0f" },
	{ id: "rust", name: "Rust Furnace", primary: "#ff5c1a", bg: "#09090c" },
	{ id: "indigo", name: "Deep Indigo", primary: "#60b4ff", bg: "#080c18" },
];

const ThemeContext = createContext<{
	theme: AppTheme;
	setTheme: (t: AppTheme) => void;
}>({ theme: "ghost", setTheme: () => {} });

export function ThemeProvider({ children }: { children: React.ReactNode }) {
	const [theme, setThemeState] = useState<AppTheme>("ghost");

	useEffect(() => {
		const saved = localStorage.getItem("app-theme") as AppTheme | null;
		const initial = saved && THEMES.find((t) => t.id === saved) ? saved : "ghost";
		setThemeState(initial);
		document.documentElement.setAttribute("data-theme", initial);
	}, []);

	function setTheme(t: AppTheme) {
		setThemeState(t);
		localStorage.setItem("app-theme", t);
		document.documentElement.setAttribute("data-theme", t);
	}

	return <ThemeContext.Provider value={{ theme, setTheme }}>{children}</ThemeContext.Provider>;
}

export function useAppTheme() {
	return useContext(ThemeContext);
}
