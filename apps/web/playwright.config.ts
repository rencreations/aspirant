import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

import { defineConfig, devices } from "@playwright/test";

/**
 * E2E runs against the static export in `out/` (exactly what ships), served by
 * e2e/static-server.mjs with GitHub Pages behaviour. Build first: `pnpm build`.
 *
 * Base path: detected from the build (a `BASE_PATH=/aspirant pnpm build` export is served
 * under /aspirant automatically). Override with E2E_BASE_PATH. Set E2E_BASE_URL to test a
 * running deployment instead (it must end with "/").
 */
const PORT = Number(process.env.E2E_PORT ?? 3190);

function detectBasePath(): string {
  if (process.env.E2E_BASE_PATH !== undefined) return process.env.E2E_BASE_PATH.replace(/\/+$/, "");
  const index = path.join(import.meta.dirname, "out", "index.html");
  if (!existsSync(index)) return "";
  const html = readFileSync(index, "utf8");
  const match = /(?:src|href)="(\/[^"]*?)\/_next\//.exec(html);
  return match?.[1] ?? "";
}

const basePath = detectBasePath();
const baseURL = process.env.E2E_BASE_URL ?? `http://127.0.0.1:${PORT}${basePath}/`;
const executablePath = process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH;

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 2 : undefined,
  reporter: process.env.CI ? [["github"], ["html", { open: "never" }]] : [["list"]],
  timeout: 45_000,
  use: {
    baseURL,
    trace: "on-first-retry",
    screenshot: "only-on-failure",
    launchOptions: executablePath ? { executablePath } : {},
  },
  metadata: { basePath },
  projects: [
    {
      name: "phone",
      use: {
        ...devices["Desktop Chrome"],
        viewport: { width: 390, height: 844 },
        isMobile: true,
        hasTouch: true,
        deviceScaleFactor: 2,
      },
    },
    {
      name: "tablet",
      use: {
        ...devices["Desktop Chrome"],
        viewport: { width: 820, height: 1180 },
        hasTouch: true,
      },
    },
    {
      name: "desktop",
      use: { ...devices["Desktop Chrome"], viewport: { width: 1440, height: 900 } },
    },
  ],
  ...(process.env.E2E_BASE_URL
    ? {}
    : {
        webServer: {
          command: `node e2e/static-server.mjs --port ${PORT}${basePath ? ` --base ${basePath}` : ""}`,
          url: baseURL,
          reuseExistingServer: !process.env.CI,
          timeout: 60_000,
        },
      }),
});
