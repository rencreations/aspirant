import { expect, type Page } from "@playwright/test";

/** Routes covered by the smoke and accessibility specs (trailing slash, no base path). */
export const ROUTES = [
  "/",
  "/about/",
  "/story/",
  "/story/prologue/",
  "/story/chapter-24/",
  "/story/the-end/",
  "/character/",
  "/character/ruby/",
  "/character/angela/",
  "/character/guinevere/",
  "/character/guinevere/story/alone/",
  "/character/guinevere/story/partner/",
  "/character/fanny/",
  "/character/layla/",
  "/character/lesley/",
  "/character/change/",
  "/character/selena/",
  "/character/selena/about/",
  "/character/selena/skills/",
  "/character/selena/gallery/",
  "/character/obsidia/",
  "/character/obsidia/about/",
  "/character/obsidia/skills/",
  "/character/obsidia/gallery/",
  "/character/vexana/",
  "/character/vexana/story/academic/",
  "/character/vexana/story/ender/",
  "/collection/",
  "/terms/",
  "/privacy/",
  "/takedown/",
] as const;

/**
 * Pages that stream video by themselves hold connections open, so the network never goes quiet
 * there: wait for `load` and a moment instead of `networkidle`. The home page plays muted clips
 * and keeps loading its deferred files in the background, so it is one of them.
 */
export function streamsVideo(route: string): boolean {
  return /^\/($|character\/(selena|obsidia|vexana|guinevere)\/|story\/$)/.test(route);
}

/** Resolve a site path against the baseURL (which may include a base path). */
export function url(path: string): string {
  return path.replace(/^\/+/, "") || "./";
}

/**
 * Skip the loader gate for this page (as a returning visitor in the same tab). Every opening is
 * skipped too (`aspirants:intro` = "off"): the roster's, About's and the home page's own (the drone
 * loader, the tap gate and the intro, which a document load of `/` otherwise runs even in a tab that
 * has entered), so none of them covers the page a spec drives.
 * Pass `{ intro: true }` to let them play (see roster-intro.spec.ts); a spec that opens `/` that way
 * then presses the tap gate with `tapHome`. The analytics question is answered (rejected) unless
 * `{ asked: false }` is passed (see consent.spec.ts).
 */
export async function skipGate(
  page: Page,
  options: { intro?: boolean; asked?: boolean } = {},
): Promise<void> {
  await page.addInitScript(
    ({ intro, asked }) => {
      try {
        window.sessionStorage.setItem("aspirants:entered", "1");
        if (!intro) window.sessionStorage.setItem("aspirants:intro", "off");
        // The analytics question has been answered (no), so its box never stands over a test.
        // `asked: false` leaves the visitor unasked (consent.spec.ts).
        if (asked) {
          window.localStorage.setItem(
            "aspirants:consent",
            JSON.stringify({ choice: "rejected", at: Date.now() }),
          );
        }
      } catch {
        /* ignore */
      }
    },
    { intro: options.intro === true, asked: options.asked !== false },
  );
}

/**
 * Presses the home page's tap gate ("Touch anywhere to continue") once it is up, and waits until the
 * page behind it can be used (`#site-shell` is no longer inert, which happens when the intro has
 * ended). For a spec that lets the home's own opening play (`skipGate(page, { intro: true })`).
 * Returns false, after `timeout` ms, when no gate came (any route but `/`, or intro off).
 */
export async function tapHome(page: Page, timeout = 60_000): Promise<boolean> {
  const gate = page.getByRole("button", { name: /touch anywhere to continue/i });
  try {
    await gate.waitFor({ state: "visible", timeout });
  } catch {
    return false;
  }
  await gate.click();
  await expect(page.locator("#site-shell")).toHaveJSProperty("inert", false, { timeout });
  return true;
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
