import { expect, test, type Page } from "@playwright/test";

import { settled, sitePath, skipGate, url } from "./helpers";

/**
 * The way back to the About page. A link of the About page carries `from=about` and the place it
 * was pressed (`at=phase-1`); the page it opens names About on its way out and leads back to that
 * place, and the About page opens there without its opening (`lib/return-to.ts`,
 * `features/about/about-root.tsx`). Without `from` every room keeps its own way out.
 */

const WAY = "from=about&at=phase-1";
const BACK = /\/about\/\?at=phase-1$/;

/** The phases of the opening the About page has shown, kept across a change of page. */
async function watchOpening(page: Page): Promise<void> {
  await page.addInitScript(() => {
    const seen: string[] = [];
    (window as unknown as { __aboutIntro: string[] }).__aboutIntro = seen;
    const note = () => {
      const now = document.querySelector("[data-about]")?.getAttribute("data-about-intro");
      if (now && seen[seen.length - 1] !== now) seen.push(now);
    };
    new MutationObserver(note).observe(document, {
      subtree: true,
      childList: true,
      attributes: true,
      attributeFilter: ["data-about-intro"],
    });
  });
}

const openingSeen = (page: Page) =>
  page.evaluate(() => (window as unknown as { __aboutIntro?: string[] }).__aboutIntro ?? []);

/** Where the top of a phase is on the screen, as a share of the screen's height. */
const phaseTop = (page: Page, n: number) =>
  page.evaluate((phase) => {
    const el = document.querySelector(`[data-about-section="phases"] li[data-phase="${phase}"]`);
    return el ? el.getBoundingClientRect().top / window.innerHeight : Number.NaN;
  }, n);

/** The About page stands at a phase: its top is in the upper part of the screen. */
async function expectAtPhase(page: Page, n: number): Promise<void> {
  await expect
    .poll(
      async () => {
        const top = await phaseTop(page, n);
        return top >= 0 && top < 0.5;
      },
      { timeout: 15_000 },
    )
    .toBe(true);
  expect(await page.evaluate(() => window.scrollY)).toBeGreaterThan(100);
}

test("the Music room leads back to About when the link came from it", async ({ page }) => {
  await skipGate(page);
  await page.goto(url(`/collection/music/?i=music-we-believe&${WAY}`));
  const back = page.locator("[data-room-back]");
  await expect(back).toHaveText("About");
  await expect(back).toHaveAttribute("href", BACK);
});

test("without the way back the Music room leads to the collection", async ({ page }) => {
  await skipGate(page);
  await page.goto(url("/collection/music/?i=music-we-believe"));
  const back = page.locator("[data-room-back]");
  await expect(back).toHaveText("Collection");
  await expect(back).toHaveAttribute("href", /\/collection\/$/);
});

test("a way back the site does not know is ignored", async ({ page }) => {
  await skipGate(page);
  await page.goto(url("/collection/music/?i=music-we-believe&from=elsewhere&at=phase-1"));
  const back = page.locator("[data-room-back]");
  await expect(back).toHaveText("Collection");
  await expect(back).toHaveAttribute("href", /\/collection\/$/);
});

test("a comic's page leads back to About, and its next comic keeps the way", async ({ page }) => {
  await skipGate(page);
  await page.goto(url(`/collection/comic/the-aspirant/?${WAY}`));
  const back = page.locator("[data-comic-bar]").getByRole("link", { name: "Back to About" });
  await expect(back).toHaveAttribute("href", BACK);
  // The page the reader writes into the address must not cost the way back.
  await expect.poll(() => page.url(), { timeout: 5000 }).toContain("p=");
  expect(page.url()).toContain(WAY);
  const next = page.getByRole("link", { name: /^Next comic/ });
  await expect(next).toHaveAttribute("href", /from=about&at=phase-1$/);
});

test("without the way back a comic's page leads to the shelf of comics", async ({ page }) => {
  await skipGate(page);
  await page.goto(url("/collection/comic/the-aspirant/"));
  const back = page.locator("[data-comic-bar]").getByRole("link", { name: "Back to the shelf" });
  await expect(back).toHaveAttribute("href", /\/collection\/comic\/$/);
});

test("the Films room leads back to About", async ({ page }) => {
  await skipGate(page);
  await page.goto(
    url(`/collection/video/films/?i=film-ruby-and-angela-video-ruby-ruby-final&${WAY}`),
  );
  const back = page.locator("[data-room-back]");
  await expect(back).toHaveText("About");
  await expect(back).toHaveAttribute("href", BACK);
});

test("the Films room keeps the way out it had for the Music room", async ({ page }) => {
  await skipGate(page);
  await page.goto(
    url("/collection/video/films/?i=film-ruby-and-angela-video-ruby-ruby-final&from=music"),
  );
  const back = page.locator("[data-room-back]");
  await expect(back).toHaveText("Music");
  await expect(back).toHaveAttribute("href", /\/collection\/music\/$/);
});

test("the interactive drama leads back to About, and to the story without the way back", async ({
  page,
}) => {
  await skipGate(page);
  await page.goto(url(`/story/interactive-drama/?${WAY}`));
  const back = page.locator("[data-drama-back]");
  await expect(back).toHaveText("About");
  await expect(back).toHaveAttribute("href", BACK);

  await page.goto(url("/story/interactive-drama/"));
  await expect(back).toHaveText("Story");
  await expect(back).toHaveAttribute("href", /\/story\/$/);
});

test("a room of the ledger leads back to the ledger", async ({ page }) => {
  await skipGate(page);
  await page.goto(url("/collection/voicelines/?from=about&at=ledger"));
  // The Voicelines room is full screen: its one way out is the room's back button.
  const back = page.locator("[data-room-back]");
  await expect(back).toHaveText("About");
  await expect(back).toHaveAttribute("href", /\/about\/\?at=ledger$/);
});

test("About opens at the place a link names, without its opening", async ({ page }) => {
  // The opening is left on: it must be the place that skips it, not the switch of the tests.
  await skipGate(page, { intro: true });
  await watchOpening(page);
  await page.goto(url("/about/?at=phase-3"));
  await expect(page.locator("[data-about]")).toHaveAttribute("data-about-intro", "done", {
    timeout: 30_000,
  });
  await expectAtPhase(page, 3);
  const seen = await openingSeen(page);
  expect(seen).not.toContain("title");
  expect(seen).not.toContain("landing");
  // The place is taken out of the address: a reload starts at the top.
  await expect.poll(() => new URL(page.url()).search).toBe("");
});

test("a place the page does not have opens About at its top", async ({ page }) => {
  await skipGate(page);
  await page.goto(url("/about/?at=nowhere"));
  await expect(page.locator("[data-about]")).toHaveAttribute("data-about-intro", "done", {
    timeout: 30_000,
  });
  expect(await page.evaluate(() => window.scrollY)).toBeLessThan(8);
});

test("pressing the way out of the Music room opens About at the phase that was left", async ({
  page,
  baseURL,
}) => {
  await skipGate(page, { intro: true });
  await watchOpening(page);
  await page.goto(url(`/collection/music/?i=music-we-believe&${WAY}`));
  // The built page has no query: the button names About once the scripts have read the address.
  const back = page.locator("[data-room-back]");
  await expect(back).toHaveText("About");
  await back.click();
  await expect.poll(() => sitePath(page, baseURL), { timeout: 30_000 }).toBe("/about/");
  await settled(page);
  await expect(page.locator("[data-about]")).toHaveAttribute("data-about-intro", "done", {
    timeout: 30_000,
  });
  await expectAtPhase(page, 1);
  expect(await openingSeen(page)).not.toContain("title");
  await expect.poll(() => new URL(page.url()).search).toBe("");
});

test("a row of the ledger opens its room with the way back, and the room leads back to it", async ({
  page,
  baseURL,
}) => {
  await skipGate(page);
  await page.goto(url("/about/"));
  await page.waitForLoadState("load");
  const row = page.locator('[data-about-section="ledger"] a[href*="/collection/music/"]');
  await expect(row).toHaveAttribute("href", /\/collection\/music\/\?from=about&at=ledger$/);
  await row.scrollIntoViewIfNeeded();
  // The drone may rest over a row: the press is the row's all the same.
  await row.click({ force: true });
  await expect.poll(() => sitePath(page, baseURL), { timeout: 30_000 }).toBe("/collection/music/");
  await settled(page);
  // The room was opened by the router this time, not by a load: the button must follow it too.
  const back = page.locator("[data-room-back]");
  await expect(back).toHaveText("About");
  await expect(back).toHaveAttribute("href", /\/about\/\?at=ledger$/);
  await back.click();
  await expect.poll(() => sitePath(page, baseURL), { timeout: 30_000 }).toBe("/about/");
  await settled(page);
  await expect
    .poll(
      () =>
        page.evaluate(() => {
          const el = document.querySelector('[data-about-section="ledger"]');
          return el ? Math.abs(el.getBoundingClientRect().top) < window.innerHeight * 0.25 : false;
        }),
      { timeout: 15_000 },
    )
    .toBe(true);
});
