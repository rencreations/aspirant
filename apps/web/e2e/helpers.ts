import { expect, type Page } from "@playwright/test";

/** Routes covered by the smoke and accessibility specs (trailing slash, no base path). */
export const ROUTES = [
  "/",
  "/experience/",
  "/story/",
  "/character/",
  "/character/fanny/",
  "/character/selena/",
  "/character/selena/about/",
  "/character/selena/skills/",
  "/character/selena/gallery/",
  "/character/obsidia/",
  "/character/obsidia/about/",
  "/character/obsidia/skills/",
  "/character/obsidia/gallery/",
  "/collection/",
] as const;

/** Resolve a site path against the baseURL (which may include a base path). */
export function url(path: string): string {
  return path.replace(/^\/+/, "") || "./";
}

/** Skip the loader gate for this page (as a returning visitor in the same tab). */
export async function skipGate(page: Page): Promise<void> {
  await page.addInitScript(() => {
    try {
      window.sessionStorage.setItem("aspirants:entered", "1");
    } catch {
      /* ignore */
    }
  });
}

/** Collect console errors and uncaught exceptions. */
export function watchErrors(page: Page): string[] {
  const errors: string[] = [];
  page.on("console", (msg) => {
    if (msg.type() === "error") errors.push(msg.text());
  });
  page.on("pageerror", (err) => errors.push(err.message));
  return errors;
}

/** Path of the current page without the base path, for example "/story/". */
export function sitePath(page: Page, baseURL: string | undefined): string {
  const base = new URL(baseURL ?? page.url()).pathname.replace(/\/+$/, "");
  const pathname = new URL(page.url()).pathname;
  return pathname.startsWith(base) ? pathname.slice(base.length) || "/" : pathname;
}

/** Wait for the page transition overlay to finish. */
export async function settled(page: Page): Promise<void> {
  await expect(page.locator('[data-overlay="transition"]')).toHaveAttribute(
    "data-active",
    "false",
    {
      timeout: 30_000,
    },
  );
}
