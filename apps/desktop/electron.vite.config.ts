import path from "node:path";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig, externalizeDepsPlugin } from "electron-vite";

const resolveFromRoot = (...segments: string[]) => path.resolve(__dirname, ...segments);

export default defineConfig({
  main: {
    plugins: [externalizeDepsPlugin({ exclude: ["@digswap/trade-domain"] })],
    resolve: {
      alias: {
        "@main": resolveFromRoot("src/main"),
        "@shared": resolveFromRoot("src/shared"),
      },
    },
  },
  preload: {
    build: {
      rollupOptions: {
        input: {
          main: resolveFromRoot("src/preload/main.ts"),
          trade: resolveFromRoot("src/preload/trade.ts"),
        },
      },
    },
    plugins: [externalizeDepsPlugin({ exclude: ["@digswap/trade-domain"] })],
    resolve: {
      alias: {
        "@shared": resolveFromRoot("src/shared"),
      },
    },
  },
  renderer: {
    plugins: [tailwindcss(), react()],
    build: {
      rollupOptions: {
        input: {
          main: resolveFromRoot("src/renderer/index.html"),
          trade: resolveFromRoot("src/renderer/renderer-trade/index.html"),
        },
      },
    },
    resolve: {
      alias: {
        "@renderer": resolveFromRoot("src/renderer/src"),
        "@shared": resolveFromRoot("src/shared"),
      },
    },
  },
});
