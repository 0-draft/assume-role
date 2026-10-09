/// <reference types="vitest/config" />
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { fileURLToPath } from "node:url";

// Served from https://0-draft.github.io/assume-role/ on GitHub Pages.
export default defineConfig({
  base: process.env.BASE_PATH ?? "/assume-role/",
  plugins: [react(), tailwindcss()],
  build: {
    rolldownOptions: {
      output: {
        // React changes far less often than the copy; give it its own
        // long-cached chunk.
        codeSplitting: {
          groups: [
            { name: "react", test: /node_modules[\\/](react|react-dom|scheduler)[\\/]/ },
          ],
        },
      },
    },
  },
  resolve: {
    alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) },
  },
  test: {
    environment: "jsdom",
    globals: true,
    // Browser tests in e2e/ run under Playwright, not Vitest.
    include: ["src/**/*.test.{ts,tsx}"],
    setupFiles: ["./src/test-setup.ts"],
    coverage: {
      provider: "v8",
      include: ["src/**/*.{ts,tsx}"],
      exclude: ["src/**/*.test.{ts,tsx}", "src/main.tsx", "src/test-setup.ts"],
    },
  },
});
