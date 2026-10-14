import { defineConfig, devices } from "@playwright/test";

const PORT = 3100;
const baseURL = process.env.E2E_BASE_URL ?? `http://127.0.0.1:${PORT}`;
// Optional: use a system Chromium instead of Playwright's downloaded build.
const executablePath = process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH;

/**
 * E2E runs against the *static export* (`out/`), exactly what ships to GitHub Pages and the
 * container, rather than the dev server. Build first: `pnpm build`.
 * Set E2E_BASE_URL to test an already-running deployment (e.g. the container) instead.
 */
export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 2 : undefined,
  reporter: process.env.CI ? [["github"], ["html", { open: "never" }]] : [["list"]],
  use: {
    baseURL,
    trace: "on-first-retry",
    screenshot: "only-on-failure",
    launchOptions: executablePath ? { executablePath } : {},
  },
  projects: [
    { name: "chromium", use: { ...devices["Desktop Chrome"] } },
    { name: "mobile", use: { ...devices["Pixel 7"] } },
  ],
  ...(process.env.E2E_BASE_URL
    ? {}
    : {
        webServer: {
          command: `pnpm exec serve out -l ${PORT} --no-clipboard`,
          url: baseURL,
          reuseExistingServer: !process.env.CI,
          timeout: 60_000,
        },
      }),
});
