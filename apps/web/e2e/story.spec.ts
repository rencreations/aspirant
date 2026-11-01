import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";

import { sitePath, skipGate, url, watchErrors } from "./helpers";

/** A reader who stopped in Chapter 12 (Part Three), as the reader saves it. */
const SAVED = JSON.stringify({
  chapterId: "c12",
  paragraphId: "c12-p004",
  textScale: 1,
  theme: "daybreak",
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
  await page.waitForTimeout(400);
}

async function openPart(page: Page, part: string, hash = "") {
  await skipGate(page);
  await page.goto(url(`/story/part-${part}/${hash}`));
  await page.waitForLoadState("networkidle");
}

async function overflow(page: Page) {
  return page.evaluate(() => {
    const el = document.scrollingElement ?? document.documentElement;
    return el.scrollWidth - window.innerWidth;
  });
}

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
      /story\/part-01\/?$/,
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
    await expect(cont).toHaveAttribute("href", /story\/part-03\/#c12-p004$/);
    await expect(page.getByRole("link", { name: "Start reading" })).toBeVisible();
    // Pinned on top of the chapter list, with its own Continue.
    const pinned = page.locator("#chapters").getByRole("link", { name: /^Continue Chapter 12/ });
    await expect(pinned).toHaveAttribute("href", /story\/part-03\/#c12-p004$/);
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

  test("the chapter list folds, opens, and sorts from the latest chapter", async ({ page }) => {
    await skipGate(page);
    await page.goto(url("/story/"));
    await page.waitForLoadState("networkidle");
    const rows = page.locator("#chapters ol > li");
    await expect(rows).toHaveCount(8);
    await expect(rows.first()).toContainText("The Student Who Was Always First");
    await page.getByRole("button", { name: /Show all 62 chapters/ }).click();
    await expect(rows).toHaveCount(62);
    await page.getByRole("button", { name: "Latest first" }).click();
    await expect(rows.first().getByRole("link")).toHaveAttribute("aria-label", /Chapter 60:/);
    await page.getByRole("button", { name: "Show fewer" }).click();
    await expect(rows).toHaveCount(8);
  });

  test("a chapter row opens its chapter on the page of its Part", async ({ page, baseURL }) => {
    await skipGate(page);
    await page.goto(url("/story/"));
    await page.waitForLoadState("networkidle");
    await page.locator("#chapters ol > li").nth(1).getByRole("link").click();
    await expect.poll(() => sitePath(page, baseURL), { timeout: 10_000 }).toBe("/story/part-01/");
    await expect.poll(() => inViewport(page, "#c02-title")).toBe(true);
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

test.describe("a Part of the story", () => {
  test("Part One: one h1, its chapters in order, plain text, no errors, no overflow", async ({
    page,
  }) => {
    const errors = watchErrors(page);
    await openPart(page, "01");
    await expect(page.locator("h1")).toHaveCount(1);
    await expect(page.getByRole("heading", { level: 1 })).toContainText("The Secret Base");
    // The text is in the page itself, before any script has fetched anything.
    await expect(page.locator("#c01-p000")).toBeAttached();
    await expect(page.locator("article[data-chapter]")).toHaveCount(4);
    await expect(
      page.getByRole("heading", { level: 2, name: /Before you begin|Three things/ }),
    ).toBeAttached();
    // Nothing behind the text, nothing that follows the reader, no rail.
    await expect(page.locator("main canvas, [data-scenes-layer]")).toHaveCount(0);
    await expect(page.locator("[data-lit]")).toHaveCount(0);
    await expect(page.locator('nav[aria-label="Chapters"], [role="slider"]')).toHaveCount(0);
    const bg = await page.evaluate(
      () => getComputedStyle(document.querySelector("div[data-theme]:has(h1)")!).backgroundColor,
    );
    expect(bg).toBe("rgb(255, 255, 255)");
    expect(await overflow(page)).toBeLessThanOrEqual(0);
    expect(errors).toEqual([]);
  });

  test("every Part has a page, with Next and Previous", async ({ page }) => {
    await openPart(page, "05");
    await expect(page.locator("h1")).toContainText(/./);
    await expect(page.getByRole("link", { name: /Previous: Part Four/ })).toBeAttached();
    await expect(page.locator('nav[aria-label="Parts of the story"]')).toContainText("Part Six");
    await openPart(page, "12");
    await expect(page.locator("#the-end details")).toHaveCount(3);
    await expect(page.locator('nav[aria-label="Parts of the story"]')).toContainText(
      "Meet the ten",
    );
  });

  test("settings: text size and theme only, and the theme is kept for every chapter", async ({
    page,
  }) => {
    await openPart(page, "01");
    await readTo(page, "c01-p003");
    await page.getByRole("button", { name: "Settings" }).click();
    const panel = page.getByRole("group", { name: "Reading settings" });
    await expect(panel).toBeVisible();
    await expect(panel.getByText("Text size")).toBeVisible();
    await expect(panel.getByRole("button", { name: /sound/i })).toHaveCount(0);
    await expect(panel.getByRole("button", { name: /calm/i })).toHaveCount(0);
    await panel.getByRole("button", { name: "Dark" }).click();
    const reader = page.locator("div[data-theme]:has(h1)");
    await expect(reader).toHaveAttribute("data-theme", "storm");
    // No chapter or Part switches the theme on its own.
    await expect(page.locator("[data-mood]")).toHaveCount(0);
    expect(await page.locator("article[data-chapter][data-theme]").count()).toBe(0);
    // It is kept on another Part, and after a reload.
    await page.goto(url("/story/part-02/"));
    await page.waitForLoadState("networkidle");
    await expect(page.locator("div[data-theme]:has(h1)")).toHaveAttribute("data-theme", "storm");
    await page.reload();
    await page.waitForLoadState("networkidle");
    await expect(page.locator("div[data-theme]:has(h1)")).toHaveAttribute("data-theme", "storm");
    await readTo(page, "c04-p003");
    await page.getByRole("button", { name: "Settings" }).click();
    await page.getByRole("button", { name: "Light" }).click();
    await expect(page.locator("div[data-theme]:has(h1)")).toHaveAttribute("data-theme", "daybreak");
  });

  test("the contents: a chapter of this Part, and a chapter of another Part", async ({
    page,
    baseURL,
  }) => {
    await openPart(page, "01");
    await readTo(page, "c01-p003");
    await page.locator("[data-contents]").click();
    const sheet = page.getByRole("dialog", { name: "Contents" });
    await expect(sheet).toBeVisible();
    await sheet.getByRole("button", { name: /Chapter 3:/ }).click();
    await expect(sheet).toBeHidden();
    await expect.poll(() => inViewport(page, "#c03-title")).toBe(true);
    await page.locator("[data-contents]").click();
    await sheet.getByText("Forty Days").click();
    await sheet.getByRole("link", { name: /Chapter 30:/ }).click();
    await expect
      .poll(() => sitePath(page, baseURL), { timeout: 10_000 })
      .toMatch(/^\/story\/part-\d{2}\/$/);
    await expect.poll(() => inViewport(page, "#c30-title"), { timeout: 10_000 }).toBe(true);
  });

  test("All chapters at the end of a Part opens the chapter list", async ({ page, baseURL }) => {
    await openPart(page, "02");
    await page.getByRole("link", { name: "All chapters" }).click();
    await expect.poll(() => sitePath(page, baseURL), { timeout: 10_000 }).toBe("/story/");
    await expect.poll(() => inViewport(page, "#chapters-title"), { timeout: 10_000 }).toBe(true);
  });

  test("a saved place goes to its paragraph", async ({ page }) => {
    await openPart(page, "03", "#c12-p004");
    await expect.poll(() => inViewport(page, "#c12-p004")).toBe(true);
  });

  test("the place is saved as the visitor reads", async ({ page }) => {
    await openPart(page, "01");
    await readTo(page, "c02-p010");
    await expect
      .poll(
        () =>
          page.evaluate(
            () =>
              (
                JSON.parse(localStorage.getItem("aspirants:reader") ?? "{}") as {
                  chapterId?: string;
                }
              ).chapterId,
          ),
        { timeout: 6000 },
      )
      .toBe("c02");
  });

  test("an entity opens the shared card by pointer, and by keyboard", async ({ page }, info) => {
    await openPart(page, "01");
    await readTo(page, "c01-p003");
    const name = page.locator("#c01-p003 button[data-ent='layla']");
    if (info.project.name === "desktop") await name.hover();
    else await name.tap();
    const card = page.locator("#reader-entity-card");
    await expect(card).toBeVisible();
    await expect(card).toContainText("Miss Hikari");
    await page.keyboard.press("Escape");
    await expect(card).toBeHidden();

    await name.focus();
    await page.keyboard.press("Enter");
    await expect(card).toHaveAttribute("role", "dialog");
    await page.keyboard.press("Escape");
    await expect(card).toBeHidden();
    await expect(name).toBeFocused();
  });

  test("the end keeps three questions open", async ({ page }) => {
    await openPart(page, "12", "#the-end");
    const files = page.locator("#the-end ol > li");
    await expect(files).toHaveCount(3);
    await files.first().locator("summary").click();
    await expect(files.first()).toContainText("Unresolved");
  });

  test("the system reduced-motion setting is ignored: nothing on the page changes", async ({
    browser,
  }) => {
    const context = await browser.newContext({ reducedMotion: "reduce" });
    const page = await context.newPage();
    await openPart(page, "01");
    await readTo(page, "c01-p020");
    await expect(page.locator("#c01-p020")).toBeVisible();
    await context.close();
  });

  test("no serious accessibility violations while reading", async ({ page }) => {
    await openPart(page, "01");
    await readTo(page, "c01-p010");
    const results = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa", "best-practice"])
      .analyze();
    const serious = results.violations
      .filter((v) => v.impact === "serious" || v.impact === "critical")
      .map((v) => ({ id: v.id, nodes: v.nodes.slice(0, 3).map((n) => n.target.join(" ")) }));
    expect(serious, JSON.stringify(serious, null, 2)).toEqual([]);
  });
});

test("an old /experience/ address goes to the story, and a chapter link to its Part", async ({
  page,
  baseURL,
}) => {
  await skipGate(page);
  await page.goto(url("/experience/"));
  await expect.poll(() => sitePath(page, baseURL), { timeout: 10_000 }).toBe("/story/");
  await page.goto(url("/experience/#c12"));
  await expect.poll(() => sitePath(page, baseURL), { timeout: 10_000 }).toBe("/story/part-03/");
});
