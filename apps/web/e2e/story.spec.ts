import fs from "node:fs";
import path from "node:path";

import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";

import { sitePath, skipGate, url, watchErrors } from "./helpers";

interface IndexEntry {
  id: string;
  slug: string;
  number: number;
  title: string;
  sealed: string | null;
  first: Array<{ kind: string }>;
}

const INDEX = JSON.parse(
  fs.readFileSync(path.resolve(process.cwd(), "public/data/story/index.json"), "utf8"),
) as { chapters: IndexEntry[] };
const SEALED = INDEX.chapters.filter((c) => c.sealed).length;

/** A reader who stopped in Chapter 12, as the reader saves it (and who has reached it). */
const SAVED = JSON.stringify({
  v: 3,
  chapterId: "c12",
  paragraphId: "c12-p004",
  textScale: 1,
  theme: "daybreak",
  furthest: 12,
});

async function inViewport(page: Page, selector: string) {
  return page.evaluate((sel) => {
    const el = document.querySelector(sel);
    if (!el) return false;
    const r = el.getBoundingClientRect();
    return r.bottom > 0 && r.top < innerHeight;
  }, selector);
}

/** Scroll so an element sits under the reading line, and give the engine a few frames. */
async function readTo(page: Page, id: string) {
  await page.evaluate((target) => {
    const el = document.getElementById(target);
    if (el) window.scrollTo(0, el.getBoundingClientRect().top + window.scrollY - innerHeight * 0.4);
  }, id);
  await page.waitForTimeout(500);
}

async function openChapter(page: Page, slug: string, hash = "") {
  await skipGate(page);
  await page.goto(url(`/story/${slug}/${hash}`));
  await page.waitForLoadState("networkidle");
}

async function overflow(page: Page) {
  return page.evaluate(() => {
    const el = document.scrollingElement ?? document.documentElement;
    return el.scrollWidth - window.innerWidth;
  });
}

const reader = (page: Page) => page.locator("div[data-theme]:has(h1)").first();

test.describe("the story page", () => {
  test("a fresh visitor: one h1, the film, Start reading is the call, no errors", async ({
    page,
  }) => {
    const errors = watchErrors(page);
    await skipGate(page);
    await page.goto(url("/story/"));
    await page.waitForLoadState("networkidle");
    await expect(page.locator("h1")).toHaveCount(1);
    await expect(page.getByRole("heading", { level: 1, name: "Aspirant Story" })).toBeAttached();
    await expect(page.locator("video")).toHaveCount(1);
    await expect(page.getByRole("link", { name: "Start reading" })).toHaveAttribute(
      "href",
      /story\/prologue\/?$/,
    );
    await expect(page.getByRole("button", { name: "Select Chapter" })).toBeVisible();
    await expect(page.getByRole("link", { name: /^Continue/ })).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Scroll for more" })).toBeVisible();
    expect(await overflow(page)).toBeLessThanOrEqual(0);
    expect(errors).toEqual([]);
  });

  test("the film fills the display", async ({ page }) => {
    await skipGate(page);
    await page.goto(url("/story/"));
    await page.waitForLoadState("networkidle");
    const sizes = await page.evaluate(() => {
      const v = document.querySelector("video");
      const r = v?.getBoundingClientRect();
      return { w: r?.width ?? 0, h: r?.height ?? 0, fit: v ? getComputedStyle(v).objectFit : "" };
    });
    expect(sizes.fit).toBe("cover");
    expect(Math.round(sizes.w)).toBeGreaterThanOrEqual(await page.evaluate(() => innerWidth));
    expect(Math.round(sizes.h)).toBeGreaterThanOrEqual(await page.evaluate(() => innerHeight));
  });

  test("a returning reader gets Continue as the call, to the saved place", async ({ page }) => {
    await skipGate(page);
    await page.addInitScript((saved) => localStorage.setItem("aspirants:reader", saved), SAVED);
    await page.goto(url("/story/"));
    await page.waitForLoadState("networkidle");
    const cont = page.getByRole("link", { name: /Continue reading where you stopped/ });
    await expect(cont).toBeVisible();
    await expect(cont).toHaveAttribute("href", /story\/chapter-12\/?#c12-p004$/);
    await expect(page.getByRole("link", { name: "Start reading" })).toBeVisible();
    // Pinned on top of the chapter list, with its own Continue.
    const pinned = page.locator("#chapters").getByRole("link", { name: /^Continue Chapter 12/ });
    await expect(pinned).toHaveAttribute("href", /story\/chapter-12\/?#c12-p004$/);
  });

  test("a place saved in the older story is not offered", async ({ page }) => {
    await skipGate(page);
    await page.addInitScript(() =>
      localStorage.setItem(
        "aspirants:reader",
        JSON.stringify({ chapterId: "c30", paragraphId: "c30-p010", textScale: 1 }),
      ),
    );
    await page.goto(url("/story/"));
    await page.waitForLoadState("networkidle");
    await expect(page.getByRole("link", { name: /^Continue/ })).toHaveCount(0);
    await expect(page.getByRole("link", { name: "Start reading" })).toBeVisible();
  });

  test("Select Chapter takes the page to the chapter list", async ({ page }) => {
    await skipGate(page);
    await page.goto(url("/story/"));
    await page.waitForLoadState("networkidle");
    await page.getByRole("button", { name: "Select Chapter" }).click();
    await expect.poll(() => inViewport(page, "#chapters-title"), { timeout: 8000 }).toBe(true);
  });

  test("the page rises over the hero and covers it", async ({ page }) => {
    await skipGate(page);
    await page.goto(url("/story/"));
    await page.waitForLoadState("networkidle");
    const top = () =>
      page.evaluate(() => document.getElementById("story-rise")?.getBoundingClientRect().top ?? -1);
    expect(await top()).toBeGreaterThanOrEqual(await page.evaluate(() => innerHeight - 2));
    await page.evaluate(() => window.scrollTo(0, innerHeight * 0.5));
    await page.waitForTimeout(250);
    const mid = await top();
    expect(mid).toBeGreaterThan(0);
    expect(mid).toBeLessThan(await page.evaluate(() => innerHeight));
    await page.evaluate(() => window.scrollTo(0, innerHeight * 1.2));
    await page.waitForTimeout(250);
    expect(await top()).toBeLessThanOrEqual(0);
    // Once it has come there is no transform left on it.
    const transform = await page.evaluate(
      () => getComputedStyle(document.getElementById("story-rise") as Element).transform,
    );
    expect(transform).toBe("none");
  });

  test("the chapter preview: a card with a picture for every chapter, folded and opened", async ({
    page,
  }) => {
    await skipGate(page);
    await page.goto(url("/story/"));
    await page.waitForLoadState("networkidle");
    const cards = page.locator("#chapters ol > li");
    await expect(cards).toHaveCount(9);
    await expect(cards.first()).toContainText("Prologue");
    await expect(cards.nth(1)).toContainText("First Place");
    await expect(cards.nth(1).getByRole("link")).toHaveAttribute("href", /story\/chapter-01\/?$/);
    await expect(cards.first().locator("img")).toHaveCount(1);
    await page.getByRole("button", { name: /Show all \d+ chapters/ }).click();
    await expect(cards).toHaveCount(INDEX.chapters.length);
    await expect(page.locator("#chapters h3")).toHaveCount(6);
    await expect(cards.last()).toContainText("Give Me Back My Freedom");
    await page.getByRole("button", { name: "Show fewer" }).click();
    await expect(cards).toHaveCount(9);
  });

  test("pictures that would give the story away are sealed until the chapter is reached", async ({
    page,
  }) => {
    await skipGate(page);
    await page.goto(url("/story/"));
    await page.waitForLoadState("networkidle");
    await page.getByRole("button", { name: /Show all \d+ chapters/ }).click();
    await expect(page.locator("#chapters").getByText("Sealed", { exact: true })).toHaveCount(
      SEALED,
    );
    await page.evaluate(() =>
      localStorage.setItem("aspirants:reader", JSON.stringify({ v: 3, furthest: 87 })),
    );
    await page.reload();
    await page.waitForLoadState("networkidle");
    await page.getByRole("button", { name: /Show all \d+ chapters/ }).click();
    await expect(page.locator("#chapters").getByText("Sealed", { exact: true })).toHaveCount(0);
  });

  test("a chapter card opens its chapter", async ({ page, baseURL }) => {
    await skipGate(page);
    await page.goto(url("/story/"));
    await page.waitForLoadState("networkidle");
    await page.locator("#chapters ol > li").nth(1).getByRole("link").click();
    await expect
      .poll(() => sitePath(page, baseURL), { timeout: 10_000 })
      .toBe("/story/chapter-01/");
    await expect(page.locator("h1")).toContainText("First Place");
  });

  test("the ten Aspirants open their own pages", async ({ page }) => {
    await skipGate(page);
    await page.goto(url("/story/"));
    await page.waitForLoadState("networkidle");
    const cards = page.locator("section[aria-labelledby='characters-title'] li a");
    await expect(cards).toHaveCount(10);
    await expect(cards.first()).toHaveAttribute("href", /character\/fanny\/$/);
    await expect(cards.last()).toHaveAttribute("href", /character\/selena\/$/);
  });

  test("no serious accessibility violations, in the light theme and the dark one", async ({
    page,
  }) => {
    test.setTimeout(150_000);
    await skipGate(page);
    await page.goto(url("/story/"));
    await page.waitForLoadState("networkidle");
    await page.evaluate(() => window.scrollTo(0, innerHeight * 1.5));
    await page.waitForTimeout(400);
    const run = async () => {
      const results = await new AxeBuilder({ page })
        .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa", "best-practice"])
        .analyze();
      return results.violations
        .filter((v) => v.impact === "serious" || v.impact === "critical")
        .map((v) => ({ id: v.id, nodes: v.nodes.slice(0, 3).map((n) => n.target.join(" ")) }));
    };
    expect(await run(), "light").toEqual([]);
    await page.evaluate(() =>
      localStorage.setItem("aspirants:reader", JSON.stringify({ theme: "storm", textScale: 1 })),
    );
    await page.reload();
    await page.waitForLoadState("networkidle");
    await page.evaluate(() => window.scrollTo(0, innerHeight * 1.5));
    await page.waitForTimeout(400);
    expect(await run(), "dark").toEqual([]);
  });
});

test.describe("a chapter of the story", () => {
  test("Chapter 5: one h1, a title card, text first, pictures set in it, no errors, no overflow", async ({
    page,
  }) => {
    const errors = watchErrors(page);
    await openChapter(page, "chapter-05");
    await expect(page.locator("h1")).toHaveCount(1);
    await expect(page.getByRole("heading", { level: 1 })).toContainText("Cover Me");
    // The text is in the page itself, before any script has fetched anything.
    await expect(page.locator("#c05-p000")).toBeAttached();
    await expect(page.locator("article[data-chapter]")).toHaveCount(1);
    // The title card has a picture or a loop, and the book's own pictures sit in the text.
    await expect(page.locator("article header").locator("img, video")).toHaveCount(1);
    expect(await page.locator("article figure img, article figure video").count()).toBeGreaterThan(
      1,
    );
    const bg = await reader(page).evaluate((el) => getComputedStyle(el).backgroundColor);
    expect(bg).toBe("rgb(255, 255, 255)");
    expect(await overflow(page)).toBeLessThanOrEqual(0);
    expect(errors).toEqual([]);
  });

  test("the Prologue opens the book, and the last chapter leads to the end page", async ({
    page,
    baseURL,
  }) => {
    await openChapter(page, "prologue");
    await expect(page.locator("h1")).toContainText("Prologue");
    await expect(page.locator("article header")).toContainText("Terrinia, 983.");
    await openChapter(page, "chapter-87");
    await page.getByRole("link", { name: /After the last page/ }).click();
    await expect.poll(() => sitePath(page, baseURL), { timeout: 10_000 }).toBe("/story/the-end/");
    await expect(page.getByRole("heading", { level: 1 })).toContainText("Who is who");
    await expect(page.locator("main li").filter({ hasText: "Miss Hikari" })).toHaveCount(1);
    await expect(page.getByRole("heading", { level: 2, name: "Timeline" })).toBeAttached();
  });

  test("a recorded line has its player under it, and pressing it does not break the page", async ({
    page,
  }) => {
    const errors = watchErrors(page);
    await skipGate(page);
    await page.addInitScript(() => localStorage.setItem("aspirants:soundPrompt", "never"));
    await page.goto(url("/story/chapter-05/"));
    await page.waitForLoadState("networkidle");
    const play = page.getByRole("button", { name: "Play the voice line of Fanny" });
    await expect(play).toBeAttached();
    await play.scrollIntoViewIfNeeded();
    await play.click();
    await page.waitForTimeout(500);
    await expect(
      page.getByRole("button", { name: /(Play|Stop) the voice line of Fanny/ }),
    ).toBeVisible();
    expect(errors).toEqual([]);
  });

  test("the top bar keeps the reading theme: bare over the title card, solid from the text on", async ({
    page,
  }) => {
    await openChapter(page, "chapter-06");
    const nav = page.locator('header[data-overlay="nav"]');
    await expect(nav).toHaveAttribute("data-lock", "true");
    await expect(nav).toHaveAttribute("data-bare", "true");
    await expect(nav).toHaveAttribute("data-theme", "daybreak");
    await expect(nav).toHaveAttribute("data-scrolled", "false");
    await readTo(page, "c06-p003");
    await expect(nav).not.toHaveAttribute("data-bare", "true");
    await expect(nav).toHaveAttribute("data-scrolled", "true");
    await expect(nav).toHaveAttribute("data-theme", "daybreak");
    // Over a dark picture it does not turn dark by itself.
    const dark = page.locator("figure img, figure video").first();
    await dark.scrollIntoViewIfNeeded();
    await page.waitForTimeout(400);
    await expect(nav).toHaveAttribute("data-theme", "daybreak");
    // It follows the visitor's own choice of theme.
    await page.evaluate(() =>
      localStorage.setItem("aspirants:reader", JSON.stringify({ v: 3, theme: "storm" })),
    );
    await page.reload();
    await expect(page.locator("h1")).toBeVisible();
    await expect(nav).toHaveAttribute("data-theme", "storm");
  });

  test("a picture opens in the viewer: press to zoom in, press again to zoom out, outside closes", async ({
    page,
  }) => {
    await openChapter(page, "chapter-06");
    const open = page.locator("button[aria-label^='View larger']").first();
    await open.scrollIntoViewIfNeeded();
    await open.click();
    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible();
    const image = dialog.locator("img");
    await expect(image).toHaveAttribute("data-zoomed", "false");
    const box = await image.boundingBox();
    if (!box) throw new Error("no picture box");
    await page.mouse.click(box.x + box.width * 0.4, box.y + box.height * 0.4);
    await expect(image).toHaveAttribute("data-zoomed", "true");
    // Dragging moves the picture and does not zoom out.
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await page.mouse.down();
    await page.mouse.move(box.x + box.width / 2 - 80, box.y + box.height / 2 - 60, { steps: 5 });
    await page.mouse.up();
    await expect(image).toHaveAttribute("data-zoomed", "true");
    await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
    await expect(image).toHaveAttribute("data-zoomed", "false");
    // The empty space beside the picture closes it; so does Escape.
    await page.waitForTimeout(700); // the picture is still shrinking back for a moment
    const height = page.viewportSize()?.height ?? 600;
    await page.mouse.click(4, Math.round(height / 2));
    await expect(dialog).toBeHidden();
    await open.click();
    await expect(dialog).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(dialog).toBeHidden();
  });

  test("the way on at the end: the next chapter", async ({ page, baseURL }) => {
    await openChapter(page, "chapter-05");
    const next = page.locator('nav[aria-label="Chapters"]').getByRole("link").first();
    await expect(next).toContainText("Chapter 6");
    await next.click();
    await expect
      .poll(() => sitePath(page, baseURL), { timeout: 10_000 })
      .toBe("/story/chapter-06/");
    await expect(page.locator("h1")).toContainText("All Rested Up?");
  });

  test("settings: text size and theme only, and the theme is kept for every chapter", async ({
    page,
  }) => {
    await openChapter(page, "chapter-01");
    await readTo(page, "c01-p003");
    await page.getByRole("button", { name: "Settings" }).click();
    const panel = page.getByRole("group", { name: "Reading settings" });
    await expect(panel).toBeVisible();
    await expect(panel.getByText("Text size")).toBeVisible();
    await expect(panel.getByRole("button", { name: /sound/i })).toHaveCount(0);
    await panel.getByRole("button", { name: "Dark" }).click();
    await expect(reader(page)).toHaveAttribute("data-theme", "storm");
    // It is kept on another chapter, and after a reload.
    await page.goto(url("/story/chapter-02/"));
    await page.waitForLoadState("networkidle");
    await expect(reader(page)).toHaveAttribute("data-theme", "storm");
    await page.reload();
    await expect(page.locator("h1")).toBeVisible();
    await expect(reader(page)).toHaveAttribute("data-theme", "storm");
    await readTo(page, "c02-p003");
    await page.getByRole("button", { name: "Settings" }).click();
    await page.getByRole("button", { name: "Light" }).click();
    await expect(reader(page)).toHaveAttribute("data-theme", "daybreak");
  });

  test("the contents: this chapter, another chapter, and the people met so far", async ({
    page,
    baseURL,
  }) => {
    await openChapter(page, "chapter-06");
    await readTo(page, "c06-p003");
    await page.locator("[data-contents]").click();
    const sheet = page.getByRole("dialog", { name: "Contents" });
    await expect(sheet).toBeVisible();
    await expect(sheet.getByRole("button", { name: /Chapter 6:/ })).toHaveAttribute(
      "aria-current",
      "location",
    );
    // Six chapters in, the reader has met these five and no one else.
    await expect(sheet.locator("section[aria-labelledby='sheet-cast-title'] li")).toHaveCount(5);
    await sheet.getByText("The First Aspirants").click();
    await sheet.getByRole("link", { name: /Chapter 24:/ }).click();
    await expect
      .poll(() => sitePath(page, baseURL), { timeout: 10_000 })
      .toBe("/story/chapter-24/");
    await expect(page.locator("h1")).toContainText("The First Light");
  });

  test("All chapters at the end of a chapter opens the chapter list", async ({ page, baseURL }) => {
    await openChapter(page, "chapter-02");
    await page.getByRole("link", { name: "All chapters" }).click();
    await expect.poll(() => sitePath(page, baseURL), { timeout: 10_000 }).toBe("/story/");
    await expect.poll(() => inViewport(page, "#chapters-title"), { timeout: 10_000 }).toBe(true);
  });

  test("a saved place goes to its paragraph", async ({ page }) => {
    await openChapter(page, "chapter-12", "#c12-p004");
    await expect.poll(() => inViewport(page, "#c12-p004")).toBe(true);
  });

  test("the place is saved as the visitor reads, with the furthest chapter", async ({ page }) => {
    await openChapter(page, "chapter-02");
    await readTo(page, "c02-p010");
    await expect
      .poll(
        () =>
          page.evaluate(() => {
            const saved = JSON.parse(localStorage.getItem("aspirants:reader") ?? "{}") as {
              chapterId?: string;
              furthest?: number;
              v?: number;
            };
            return `${saved.chapterId}:${saved.furthest}:${saved.v}`;
          }),
        { timeout: 6000 },
      )
      .toBe("c02:2:3");
  });

  test("an old Part address opens a chapter of the new book", async ({ page, baseURL }) => {
    await skipGate(page);
    await page.goto(url("/story/part-03/"));
    await expect
      .poll(() => sitePath(page, baseURL), { timeout: 10_000 })
      .toMatch(/^\/story\/(prologue|chapter-\d{2})\/$/);
    await expect(page.locator("h1")).toBeVisible();
  });

  test("the system reduced-motion setting is ignored: nothing on the page changes", async ({
    browser,
  }) => {
    const context = await browser.newContext({ reducedMotion: "reduce" });
    const page = await context.newPage();
    await openChapter(page, "chapter-05");
    await readTo(page, "c05-p020");
    await expect(page.locator("#c05-p020")).toBeVisible();
    await context.close();
  });

  test("no serious accessibility violations while reading, in both themes", async ({ page }) => {
    test.setTimeout(150_000);
    await openChapter(page, "chapter-12");
    await readTo(page, "c12-p010");
    const run = async () => {
      const results = await new AxeBuilder({ page })
        .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa", "best-practice"])
        .analyze();
      return results.violations
        .filter((v) => v.impact === "serious" || v.impact === "critical")
        .map((v) => ({ id: v.id, nodes: v.nodes.slice(0, 3).map((n) => n.target.join(" ")) }));
    };
    expect(await run(), "light").toEqual([]);
    await page.evaluate(() =>
      localStorage.setItem("aspirants:reader", JSON.stringify({ v: 3, theme: "storm" })),
    );
    await page.reload();
    await page.waitForLoadState("networkidle");
    await readTo(page, "c12-p010");
    expect(await run(), "dark").toEqual([]);
  });
});

/** At the very end of the page, at rest. */
async function toEnd(page: Page) {
  await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
  await expect
    .poll(() =>
      page.evaluate(
        () => Math.ceil(window.scrollY + innerHeight) >= document.documentElement.scrollHeight - 1,
      ),
    )
    .toBe(true);
  await page.waitForTimeout(400);
}

/**
 * Wheel steps over the middle of the screen, close together (one gesture). A step is 100 device
 * pixels, so 50 page pixels on the phone (pixel ratio 2): the counts allow for that.
 */
async function wheel(page: Page, dy: number, steps: number) {
  const size = page.viewportSize() ?? { width: 1280, height: 720 };
  await page.mouse.move(size.width / 2, size.height / 2);
  for (let i = 0; i < steps; i += 1) {
    await page.mouse.wheel(0, dy);
    await page.waitForTimeout(40);
  }
}

/**
 * Notes when the pull indicator comes on (the page sets its opacity to 1). It drains again soon
 * after the wheel stops, and on a busy machine a poll of its opacity can miss it.
 */
async function watchPull(page: Page, which: "up" | "down") {
  await page.evaluate((w) => {
    const el = document.querySelector<HTMLElement>(`[data-pull="${w}"]`);
    const flag = window as unknown as { __pullShown?: boolean };
    flag.__pullShown = false;
    if (!el) return;
    new MutationObserver(() => {
      if (el.style.opacity === "1") flag.__pullShown = true;
    }).observe(el, { attributes: true, attributeFilter: ["style"] });
  }, which);
}

const pullShown = (page: Page) =>
  page.evaluate(() => (window as unknown as { __pullShown?: boolean }).__pullShown === true);

/** The page has landed: no morph layer is left, the scroll is free again. */
async function landed(page: Page) {
  await expect(page.locator("[data-morph]")).toHaveCount(0, { timeout: 15_000 });
}

const door = (page: Page) => page.locator('nav[aria-label="Chapters"]').getByRole("link").first();

test.describe("moving between chapters (the chapter morph)", () => {
  test("the card opens the next chapter: at its top, its heading focused, the bar bare", async ({
    page,
    baseURL,
  }) => {
    const errors = watchErrors(page);
    await openChapter(page, "chapter-05");
    await toEnd(page);
    await door(page).click();
    // The layer takes over the screen (the logo curtain does not).
    await expect(page.locator("[data-morph]")).toBeAttached();
    await expect
      .poll(() => sitePath(page, baseURL), { timeout: 15_000 })
      .toBe("/story/chapter-06/");
    await landed(page);
    await expect(page.locator("h1")).toHaveCount(1);
    await expect(page.locator("h1")).toContainText("All Rested Up?");
    await expect(page.locator("h1")).toBeFocused();
    expect(await page.evaluate(() => window.scrollY)).toBe(0);
    const nav = page.locator('header[data-overlay="nav"]');
    await expect(nav).toHaveAttribute("data-bare", "true");
    await expect(nav).toHaveAttribute("data-lock", "true");
    expect(errors).toEqual([]);
  });

  test("the wheel at the bottom shows the pull, and past it opens the next chapter", async ({
    page,
    baseURL,
  }) => {
    await openChapter(page, "chapter-05");
    await toEnd(page);
    await watchPull(page, "down");
    await wheel(page, 100, 3);
    await expect.poll(() => pullShown(page)).toBe(true);
    await expect(page.locator('[data-pull="down"]')).toContainText("Chapter 6");
    // Big steps, so the pull fills even when the steps come slowly and it drains between them.
    await wheel(page, 300, 8);
    await expect
      .poll(() => sitePath(page, baseURL), { timeout: 15_000 })
      .toBe("/story/chapter-06/");
    await landed(page);
    await expect(page.locator("h1")).toContainText("All Rested Up?");
    expect(await page.evaluate(() => window.scrollY)).toBe(0);
  });

  test("the wheel up at the top opens the chapter before at its end, with its card on screen", async ({
    page,
    baseURL,
  }) => {
    await openChapter(page, "chapter-06");
    await page.waitForTimeout(400);
    await watchPull(page, "up");
    await wheel(page, -100, 3);
    await expect.poll(() => pullShown(page)).toBe(true);
    await wheel(page, -300, 8);
    await expect
      .poll(() => sitePath(page, baseURL), { timeout: 15_000 })
      .toBe("/story/chapter-05/");
    await landed(page);
    await expect(page.locator("h1")).toContainText("Cover Me");
    await expect(door(page)).toContainText("Chapter 6");
    await expect.poll(() => inViewport(page, 'nav[aria-label="Chapters"] a')).toBe(true);
    expect(await page.evaluate(() => window.scrollY)).toBeGreaterThan(0);
    await expect(page.locator('header[data-overlay="nav"]')).not.toHaveAttribute(
      "data-bare",
      "true",
    );
  });

  test("Before opens the chapter before at its top", async ({ page, baseURL }) => {
    await openChapter(page, "chapter-06");
    await toEnd(page);
    await page.getByRole("link", { name: "Before: Cover Me" }).click();
    await expect
      .poll(() => sitePath(page, baseURL), { timeout: 15_000 })
      .toBe("/story/chapter-05/");
    await landed(page);
    await expect(page.locator("h1")).toContainText("Cover Me");
    await expect(page.locator("h1")).toBeFocused();
    expect(await page.evaluate(() => window.scrollY)).toBe(0);
    await expect(page.locator('header[data-overlay="nav"]')).toHaveAttribute("data-bare", "true");
  });

  test("a modified click on the card opens the plain link, and nothing moves here", async ({
    page,
    context,
    baseURL,
  }) => {
    await openChapter(page, "chapter-05");
    await toEnd(page);
    const [opened] = await Promise.all([
      context.waitForEvent("page"),
      door(page).click({ modifiers: ["ControlOrMeta"] }),
    ]);
    await expect
      .poll(() => sitePath(opened, baseURL), { timeout: 15_000 })
      .toBe("/story/chapter-06/");
    await opened.close();
    expect(sitePath(page, baseURL)).toBe("/story/chapter-05/");
    await expect(page.locator("[data-morph]")).toHaveCount(0);
  });
});

test("an old /experience/ address goes to the story, and a chapter link to a chapter", async ({
  page,
  baseURL,
}) => {
  await skipGate(page);
  await page.goto(url("/experience/"));
  await expect.poll(() => sitePath(page, baseURL), { timeout: 10_000 }).toBe("/story/");
  await page.goto(url("/experience/#c12"));
  await expect
    .poll(() => sitePath(page, baseURL), { timeout: 10_000 })
    .toMatch(/^\/story\/(prologue|chapter-\d{2})\/$/);
});
