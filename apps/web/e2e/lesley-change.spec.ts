import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

import { skipGate, url, watchErrors } from "./helpers";

/**
 * Lesley's page and Chang'e's page are two ends of one channel. The test browser may not decode
 * H.264, so these specs check what does not depend on playback: the layout, the first screen's
 * scope and bench, the deck of notes, the voice log, the gallery and the link between the two.
 */
test.describe.configure({ timeout: 90_000 });

const PAGES = [
  { who: "lesley", name: "Lesley", partner: "Chang'e", partnerSlug: "change" },
  { who: "change", name: "Chang'e", partner: "Lesley", partnerSlug: "lesley" },
] as const;

test.beforeEach(async ({ page }) => {
  await skipGate(page);
});

for (const { who, name, partner, partnerSlug } of PAGES) {
  test.describe(`${who}'s page`, () => {
    test("loads with one h1, every section, no errors and no overflow", async ({ page }) => {
      const errors = watchErrors(page);
      const response = await page.goto(url(`/character/${who}/`));
      expect(response?.status()).toBe(200);
      await page.waitForLoadState("networkidle");
      await expect(page.locator("h1")).toHaveCount(1);
      await expect(page.getByRole("heading", { level: 1, name })).toBeVisible();
      for (const id of ["profile", "notes", "voice", "films", "gallery", "together"])
        await expect(page.locator(`section#${id}`)).toHaveCount(1);
      const overflow = await page.evaluate(
        () => (document.scrollingElement ?? document.documentElement).scrollWidth - innerWidth,
      );
      expect(overflow).toBeLessThanOrEqual(0);
      await expect(page.getByRole("button", { name: /^Continue to/ })).toHaveCount(1);
      expect(errors).toEqual([]);
    });

    test("the first screen's button acts, and what it draws goes away again", async ({ page }) => {
      await page.goto(url(`/character/${who}/`));
      await page.waitForLoadState("networkidle");
      const drawn = page.locator("#top div[aria-hidden='true'] > span");
      const button = page.getByRole("button", {
        name: who === "lesley" ? "Take a shot" : "Drop a pin",
      });
      const before = await drawn.count();
      await button.click();
      if (who === "lesley") {
        // The scope drifts, takes a clean shot, and the thread, flash and hit mark fade.
        await expect.poll(() => drawn.count(), { timeout: 4000 }).toBeGreaterThan(before);
        await expect.poll(() => drawn.count(), { timeout: 6000 }).toBeLessThanOrEqual(before);
        await expect(page.locator("#top")).toContainText("01");
      } else {
        await expect.poll(() => drawn.count(), { timeout: 2000 }).toBeGreaterThan(before);
        await button.click();
        await expect(page.getByRole("button", { name: "Clear pins" })).toBeVisible();
        await page.keyboard.press("Escape");
        await expect(page.getByRole("button", { name: "Clear pins" })).toHaveCount(0);
        await expect.poll(() => drawn.count()).toBeLessThanOrEqual(before);
      }
    });

    test("a press on the picture works with a pointer", async ({ page }, info) => {
      test.skip(info.project.name !== "desktop", "A press needs a pointer here");
      await page.goto(url(`/character/${who}/`));
      await page.waitForLoadState("networkidle");
      const drawn = page.locator("#top div[aria-hidden='true'] > span");
      const before = await drawn.count();
      await page.mouse.move(700, 420);
      await page.mouse.down();
      if (who === "lesley") await page.waitForTimeout(550);
      await page.mouse.up();
      await expect.poll(() => drawn.count(), { timeout: 2000 }).toBeGreaterThan(before);
      if (who === "lesley") await expect(page.locator("#top")).toContainText("01");
      if (who === "change") {
        // Pins, a guide and a label are made; the ripples and markers are not in that layer.
        await page.mouse.click(1000, 500);
        await expect(page.locator("#top")).toContainText(" u");
      }
    });

    if (who === "change") {
      test("the markers open a line about what she built", async ({ page }) => {
        await page.goto(url("/character/change/"));
        const chip = page.locator("#top aside").getByRole("button", { name: "Mr. Bunny" });
        await expect(chip).toHaveAttribute("aria-pressed", "false");
        await chip.click();
        await expect(chip).toHaveAttribute("aria-pressed", "true");
        await expect(page.locator("#top aside")).toContainText("tin rabbit");
        await chip.click();
        await expect(chip).toHaveAttribute("aria-pressed", "false");
      });
    }

    test("the notes are a deck: one card on top, with buttons and arrow keys", async ({ page }) => {
      await page.goto(url(`/character/${who}/`));
      const top = page.locator("section#notes article[aria-hidden='false']");
      await expect(top).toHaveCount(1);
      const first = await top.innerText();
      await expect(page.locator("section#notes article")).toHaveCount(6);
      const next = page.getByRole("button", { name: "Next", exact: true });
      await next.scrollIntoViewIfNeeded();
      await next.focus();
      await page.keyboard.press("ArrowRight");
      await expect(page.getByText("Note 2 of 6")).toBeAttached();
      expect(await top.innerText()).not.toBe(first);
      await page.keyboard.press("ArrowLeft");
      await page.keyboard.press("ArrowLeft");
      await expect(page.getByText("Note 6 of 6")).toBeAttached();
      await page.getByRole("button", { name: /^Note 3:/ }).click();
      await expect(page.getByText("Note 3 of 6")).toBeAttached();
    });

    test("the voice log lists her lines and the gallery opens the viewer", async ({ page }) => {
      await page.goto(url(`/character/${who}/`));
      const lines = page.locator("section#voice ul button");
      expect(await lines.count()).toBeGreaterThan(20);
      await expect(lines.first()).toHaveAttribute("aria-pressed", "false");
      const tiles = page.locator("section#gallery ul button");
      await expect(tiles).toHaveCount(2);
      await tiles.first().scrollIntoViewIfNeeded();
      await tiles.first().click();
      await expect(page.getByRole("dialog")).toBeVisible();
      await page.keyboard.press("Escape");
      await expect(page.getByRole("dialog")).toHaveCount(0);
    });

    test("leads to her partner's page, from the pill and from the meeting", async ({ page }) => {
      await page.goto(url(`/character/${who}/`));
      const link = page.getByRole("link", { name: new RegExp(`^Meet ${partner}`) });
      await expect(link).toHaveAttribute("href", new RegExp(`/character/${partnerSlug}/`));
      // The pill is hidden on the first screen and shows after it.
      const pill = page.locator("a[aria-label^='Switch to']");
      await expect(pill).toHaveAttribute("aria-hidden", "true");
      await page.evaluate(() => window.scrollTo(0, innerHeight * 1.4));
      await expect(pill).toHaveAttribute("aria-hidden", "false");
      await expect(pill).toHaveAttribute("href", new RegExp(`/character/${partnerSlug}/`));
    });

    test("has no serious accessibility violations", async ({ page }) => {
      await page.goto(url(`/character/${who}/`));
      await page.waitForLoadState("networkidle");
      const results = await new AxeBuilder({ page })
        .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa", "best-practice"])
        .analyze();
      const found = results.violations
        .filter((v) => v.impact === "serious" || v.impact === "critical")
        .map((v) => ({ id: v.id, help: v.help, nodes: v.nodes.map((n) => n.target.join(" ")) }));
      expect(found, JSON.stringify(found, null, 2)).toEqual([]);
    });
  });
}
