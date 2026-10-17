import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";

import { skipGate, url, watchErrors } from "./helpers";

/** Scroll so an element sits under the reading line, and give the engine a few frames. */
async function readTo(page: Page, id: string) {
  await page.evaluate((target) => {
    const el = document.getElementById(target);
    if (el) window.scrollTo(0, el.getBoundingClientRect().top + window.scrollY - innerHeight * 0.4);
  }, id);
  await page.waitForTimeout(400);
}

async function openReader(page: Page, hash = "") {
  await skipGate(page);
  await page.goto(url(`/experience/${hash}`));
  await page.waitForLoadState("networkidle");
  // Part One loads lazily: wait for its first paragraph.
  await expect(page.locator("#c01-p000")).toBeAttached({ timeout: 15_000 });
}

async function inViewport(page: Page, selector: string) {
  return page.evaluate((sel) => {
    const el = document.querySelector(sel);
    if (!el) return false;
    const r = el.getBoundingClientRect();
    return r.bottom > 0 && r.top < innerHeight;
  }, selector);
}

test.describe("experience reader", () => {
  test("loads the opening, one h1, Part One, no errors, no overflow", async ({ page }) => {
    const errors = watchErrors(page);
    await openReader(page);
    await expect(page.locator("h1")).toHaveCount(1);
    await expect(page.getByRole("heading", { level: 1 })).toContainText("The Aspirants");
    await expect(page.getByRole("heading", { level: 2, name: /Part One/ })).toBeAttached();
    await expect(page.locator("h3")).toHaveCount(62 + 3 + 3);
    await expect(page.locator('nav[aria-label="Chapters"]')).toBeAttached();
    await readTo(page, "c01-p003");
    await expect(page.locator("[data-lit]")).toHaveCount(1);
    const overflow = await page.evaluate(
      () => (document.scrollingElement ?? document.documentElement).scrollWidth - innerWidth,
    );
    expect(overflow).toBeLessThanOrEqual(0);
    expect(errors).toEqual([]);
  });

  test("the contents jump to Chapter 30 and load its Part", async ({ page }) => {
    await openReader(page);
    await readTo(page, "c01");
    await page.locator("[data-contents]").click();
    const sheet = page.getByRole("dialog", { name: "Contents" });
    await expect(sheet).toBeVisible();
    await sheet.getByText("Forty Days").click();
    await sheet.getByRole("button", { name: /Chapter 30:/ }).click();
    await expect(sheet).toBeHidden();
    await expect(page.locator("#c30-p000")).toBeAttached({ timeout: 15_000 });
    await expect.poll(() => inViewport(page, "#c30-title")).toBe(true);
    await expect(page.locator("#c30-title")).toBeFocused();
  });

  test("the chapter rail moves by keyboard (desktop)", async ({ page }, info) => {
    test.skip(info.project.name !== "desktop", "The rail is a desktop control");
    await openReader(page, "#c29");
    await expect.poll(() => inViewport(page, "#c29-title")).toBe(true);
    const rail = page.getByRole("slider", { name: "Chapter timeline" });
    await expect(rail).toHaveAttribute("aria-valuetext", /Chapter 29/);
    await rail.focus();
    await page.keyboard.press("ArrowDown");
    await expect(rail).toHaveAttribute("aria-valuetext", /Chapter 30/);
    await page.keyboard.press("Enter");
    await expect.poll(() => inViewport(page, "#c30-title")).toBe(true);
  });

  test("an entity opens the shared card by pointer", async ({ page }, info) => {
    await openReader(page);
    await readTo(page, "c01-p003");
    const name = page.locator("#c01-p003 button[data-ent='layla']");
    if (info.project.name === "desktop") await name.hover();
    else await name.tap();
    const card = page.locator("#reader-entity-card");
    await expect(card).toBeVisible();
    await expect(card).toContainText("Miss Hikari");
    await expect(card.getByRole("button", { name: /Hear her/ })).toBeVisible();
    await expect(card.getByRole("link", { name: /Layla/ })).toBeVisible();
    // Only one card exists for the whole book.
    await expect(page.locator("#reader-entity-card")).toHaveCount(1);
    await page.keyboard.press("Escape");
    await expect(card).toBeHidden();
  });

  test("an entity opens by keyboard; Enter pins it, Esc returns focus", async ({ page }) => {
    await openReader(page);
    await readTo(page, "c01-p000");
    const name = page.locator("#c01-p002 button[data-ent='terrinia']");
    await page.locator("#c01-p000 button[data-ent]").first().focus();
    await page.keyboard.press("Tab");
    await page.keyboard.press("Tab");
    await expect(name).toBeFocused();
    const card = page.locator("#reader-entity-card");
    await expect(card).toBeVisible();
    await expect(card).toHaveAttribute("role", "tooltip");
    await expect(name).toHaveAttribute("aria-describedby", "reader-entity-card");
    await expect(card).toContainText("Terrinia");
    await page.keyboard.press("Escape");
    await expect(card).toBeHidden();
    await expect(name).toBeFocused();

    const layla = page.locator("#c01-p003 button[data-ent='layla']");
    await layla.focus();
    await page.keyboard.press("Enter");
    await expect(card).toHaveAttribute("role", "dialog");
    await expect(card.getByRole("button", { name: /Hear her/ })).toBeFocused();
    await page.keyboard.press("Escape");
    await expect(card).toBeHidden();
    await expect(layla).toBeFocused();
  });

  test("reduced motion shows key lines whole and keeps the lit paragraph", async ({ browser }) => {
    const context = await browser.newContext({ reducedMotion: "reduce" });
    const page = await context.newPage();
    await openReader(page);
    await readTo(page, "c01-p020");
    const word = page.locator("#c01-p018 [data-w]").first();
    await expect(word).toBeVisible();
    const colours = await page.evaluate(() => {
      const w = document.querySelector<HTMLElement>("#c01-p018 [data-w]");
      return w ? [getComputedStyle(w).transform, getComputedStyle(w).opacity] : null;
    });
    expect(colours).toEqual(["none", "1"]);
    await expect(page.locator("[data-lit]")).toHaveCount(1);
    const beat = await page.evaluate(() => {
      const inner = document.querySelector("[data-unit='beat'] figure");
      return inner ? getComputedStyle(inner).position : null;
    });
    expect(beat).toBe("relative");
    await context.close();
  });

  test("resume appears for a returning reader", async ({ page }) => {
    await skipGate(page);
    await page.addInitScript(() => {
      localStorage.setItem(
        "aspirants:reader",
        JSON.stringify({ chapterId: "c12", paragraphId: "c12-p004", textScale: 1, calm: false }),
      );
    });
    await page.goto(url("/experience/"));
    await page.waitForLoadState("networkidle");
    const resume = page.getByRole("button", { name: /Resume where you left off/ });
    await expect(resume).toBeVisible();
    await resume.click();
    await expect(page.locator("#c12-p004")).toBeAttached({ timeout: 15_000 });
    await expect.poll(() => inViewport(page, "#c12-p004")).toBe(true);
  });

  test("the end keeps three sealed questions open", async ({ page }) => {
    await openReader(page, "#the-end");
    const files = page.locator("#the-end ol > li");
    await expect(files).toHaveCount(3);
    const seal = files.first().getByRole("button", { name: "Break the seal" });
    await seal.focus();
    await page.keyboard.press("Enter");
    await expect(files.first()).toContainText("The story does not say so.");
    await expect(files.first()).toContainText("Unresolved");
    await expect(page.locator("#the-end").getByText("THE END", { exact: true })).toBeVisible();
  });

  test("no serious accessibility violations while reading", async ({ page }) => {
    // The whole book skeleton is in the DOM, so axe needs longer on a phone profile.
    test.setTimeout(150_000);
    await openReader(page);
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
