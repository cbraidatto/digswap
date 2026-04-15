import path from "node:path";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

export default defineConfig({
	plugins: [react()],
	test: {
		env: {
			NEXT_PUBLIC_SUPABASE_URL: "https://test.supabase.co",
			NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "test-anon-key",
			SUPABASE_SERVICE_ROLE_KEY: "test-service-role-key",
			DATABASE_URL: "postgresql://test:test@localhost:5432/test",
			DISCOGS_CONSUMER_KEY: "test-discogs-key",
			DISCOGS_CONSUMER_SECRET: "test-discogs-secret",
			IMPORT_WORKER_SECRET: "test-import-worker-secret",
			STRIPE_SECRET_KEY: "test-stripe-secret-key",
		},
		environment: "jsdom",
		include: ["tests/**/*.test.ts", "tests/**/*.test.tsx", "src/tests/**/*.test.ts", "src/lib/**/*.test.ts"],
		globals: true,
		setupFiles: ["tests/setup.ts"],
		coverage: {
			provider: "v8",
			include: ["src/actions/**", "src/lib/**", "src/components/**"],
			exclude: [
				"src/lib/db/schema/**",
				"src/lib/supabase/**",
				"**/*.d.ts",
			],
			reporter: ["text", "html", "json-summary"],
			reportsDirectory: "./coverage",
			thresholds: {
				statements: 40,
				branches: 35,
				functions: 35,
				lines: 40,
			},
		},
	},
	resolve: {
		alias: {
			"@": path.resolve(__dirname, "./src"),
			"server-only": path.resolve(__dirname, "./tests/stubs/server-only.ts"),
		},
	},
});
