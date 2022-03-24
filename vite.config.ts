/// <reference types="vitest" />
import path from "path";
import { defineConfig } from "vite";

export default defineConfig({
  build: {
    outDir: "./build",
    lib: {
      entry: path.resolve(__dirname, "src/index.ts"),
      name: "Marzipano",
      fileName: (format) => `marzipano.${format}.js`,
    },
  },
  test: {
    environment: "happy-dom",
    exclude: [
      "node_modules",
      "dist",
      ".idea",
      ".git",
      ".cache",
      "e2e",
      "build",
    ],
  },
});
