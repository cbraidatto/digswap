import path from "node:path";
import react from "@vitejs/plugin-react";
import { defineConfig, externalizeDepsPlugin } from "electron-vite";

const resolveFromRoot = (...segments: string[]) => path.resolve(__dirname, ...segments);

export default defineConfig({
  main: {
    plugins: [externalizeDepsPlugin()],
    resolve: {
      alias: {
        "@main": resolveFromRoot("src/main"),
        "@shared": resolveFromRoot("src/shared"),
      },
    },
  },
  preload: {
    plugins: [externalizeDepsPlugin()],
    resolve: {
      alias: {
        "@shared": resolveFromRoot("src/shared"),
      },
    },
  },
  renderer: {
    plugins: [react()],
    resolve: {
      alias: {
        "@renderer": resolveFromRoot("src/renderer/src"),
        "@shared": resolveFromRoot("src/shared"),
      },
    },
  },
});
