import path from "node:path";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

export default defineConfig({
	plugins: [react()],
	test: {
		environment: "jsdom",
		include: ["tests/**/*.test.ts", "tests/**/*.test.tsx", "src/tests/**/*.test.ts"],
		globals: true,
		setupFiles: ["tests/setup.ts"],
		coverage: {
			provider: "v8",
			include: ["src/actions/**", "src/lib/**"],
			exclude: [
				"src/lib/db/schema/**",
				"src/lib/supabase/**",
				"**/*.d.ts",
			],
			reporter: ["text", "html", "json-summary"],
			reportsDirectory: "./coverage",
		},
	},
	resolve: {
		alias: {
			"@": path.resolve(__dirname, "./src"),
			"server-only": path.resolve(__dirname, "./tests/stubs/server-only.ts"),
		},
	},
});
