import { defineConfig, devices } from "@playwright/test";

const PORT = 4317;

// Runs against the production build on the same base path as GitHub Pages.
export default defineConfig({
  testDir: "e2e",
  fullyParallel: true,
  // Every test waits for all lazy chapters; under a full parallel run that can
  // take a while on a busy machine.
  timeout: 60_000,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [["github"], ["html", { open: "never" }]] : "list",
  use: {
    baseURL: `http://localhost:${PORT}/assume-role/`,
    trace: "retain-on-failure",
  },
  projects: [
    {
      name: "desktop",
      use: { ...devices["Desktop Chrome"], viewport: { width: 1400, height: 900 } },
    },
    {
      name: "phone",
      use: { ...devices["Pixel 7"], viewport: { width: 390, height: 844 } },
    },
  ],
  webServer: {
    command: `npm run build && npx vite preview --port ${PORT} --strictPort`,
    url: `http://localhost:${PORT}/assume-role/`,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
